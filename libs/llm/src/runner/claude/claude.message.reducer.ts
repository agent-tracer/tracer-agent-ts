import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { logWarn } from "@tracer-agent/platform";
import { AGENT_ERROR_SUBTYPE, PROVIDER_ERROR_SUBTYPE, UnpricedModelError } from "~llm/model/agent.error.js";
import type { AgentQueryUsage } from "~llm/model/agent.usage.js";
import type { JobStepToolCall } from "~llm/model/job.step.js";
import type { TrajectoryRecorder } from "~llm/observability/trajectory.js";
import { estimateCostUsd } from "~llm/pricing/pricing.js";
import type { LandingPacer } from "~llm/runner/landing.pacer.js";
import type { AgentQueryRequest, AgentStreamSink } from "~llm/runner/llm.runner.js";
import type { ClaudeQueryOptions } from "./claude.query.options.js";
import {
    dominantModel,
    normalizeClaudeResultSubtype,
    toToolArgs,
    toolResultText,
    toUsage,
} from "./claude.query.mappers.js";
import { reportPermissionDenials } from "./claude.query.permissions.js";
import { providerSubtypeFromTerminalReason } from "./claude.terminal.reason.js";
import { partialAssistantDeltaText } from "./claude.stream.delta.js";

/** 접어 낸 한 실행의 값이며 실행기는 여기에 시각과 궤적만 더해 결과로 낸다. */
export interface ReducedQuery {
    readonly rawOutput: string;
    readonly structuredOutput: unknown;
    readonly numTurns: number | null;
    readonly costUsd: number | null;
    readonly usage: AgentQueryUsage | null;
    readonly errorSummary: string | null;
    readonly errorSubtype: string | null;
    readonly actualModel: string | null;
    readonly providerRequestId: string | null;
    readonly ttftMs: number | null;
}

export interface ClaudeMessageReducerDeps {
    readonly request: AgentQueryRequest<ClaudeQueryOptions>;
    readonly trajectory: TrajectoryRecorder;
    readonly pacer: LandingPacer;
    readonly sink: AgentStreamSink | undefined;
}

/** SDK 메시지를 오는 대로 하나의 실행 결과로 접으며 하위 프로세스를 알지 못한다. */
export class ClaudeMessageReducer {
    private collected = "";
    private resultText = "";
    private structuredOutput: unknown = null;
    private numTurns: number | null = null;
    private costUsd: number | null = null;
    private usage: AgentQueryUsage | null = null;
    private errorSummary: string | null = null;
    private errorSubtype: string | null = null;
    private actualModel: string | null = null;
    private providerRequestId: string | null = null;
    private ttftMs: number | null = null;
    private readonly toolNameById = new Map<string, string>();

    constructor(private readonly deps: ClaudeMessageReducerDeps) {}

    /** 접을 것이 남았으면 true 를 내고 결과 메시지를 받아 끝났으면 false 를 낸다. */
    accept(msg: SDKMessage): boolean {
        if (msg.type === "stream_event") {
            this.acceptStreamEvent(msg);
            return true;
        }
        if (msg.type === "assistant") {
            this.acceptAssistant(msg);
            return true;
        }
        if (msg.type === "user") {
            this.acceptToolResults(msg);
            return true;
        }
        if (msg.type === "result") {
            this.acceptResult(msg);
            return false;
        }
        return true;
    }

    snapshot(): ReducedQuery {
        return {
            rawOutput: this.resultText || this.collected,
            structuredOutput: this.structuredOutput,
            numTurns: this.numTurns,
            costUsd: this.costUsd,
            usage: this.usage,
            errorSummary: this.errorSummary,
            errorSubtype: this.errorSubtype,
            actualModel: this.actualModel,
            providerRequestId: this.providerRequestId,
            ttftMs: this.ttftMs,
        };
    }

    /** 부분 메시지가 켜진 실행에서만 오며 사고 블록과 도구 인자는 글자를 내지 않아 진행만 알린다. */
    private acceptStreamEvent(msg: Extract<SDKMessage, { type: "stream_event" }>): void {
        const { sink } = this.deps;
        if (sink === undefined) return;
        sink.onProgress?.();
        const delta = partialAssistantDeltaText(msg.event);
        if (delta.length > 0) sink.onAssistantDelta(delta);
    }

    private acceptAssistant(msg: Extract<SDKMessage, { type: "assistant" }>): void {
        const { sink, trajectory, pacer } = this.deps;
        pacer.countTurn();
        // 공급자 식별자는 모델 호출 하나를 가리키므로 마지막 호출의 값이 이 시도를 대표한다.
        if (msg.request_id !== undefined) this.providerRequestId = msg.request_id;
        let text = "";
        const toolCalls: JobStepToolCall[] = [];
        for (const block of msg.message.content) {
            if (block.type === "text") text += block.text;
            if (block.type === "tool_use") {
                const args = toToolArgs(block.input);
                toolCalls.push({ id: block.id, name: block.name, args });
                this.toolNameById.set(block.id, block.name);
                sink?.onToolCall({ id: block.id, name: block.name, args });
            }
        }
        this.collected += text;
        const callUsage: AgentQueryUsage = {
            inputTokens: msg.message.usage.input_tokens,
            outputTokens: msg.message.usage.output_tokens,
            cacheReadTokens: msg.message.usage.cache_read_input_tokens ?? 0,
            cacheCreationTokens: msg.message.usage.cache_creation_input_tokens ?? 0,
        };
        trajectory.assistant({
            content: text,
            toolCalls,
            ...callUsage,
            ...(msg.message.stop_reason !== null ? { stopReason: msg.message.stop_reason } : {}),
        });
        this.spendOnCall(msg.message.model, callUsage);
    }

    /** 예산을 건 실행만 호출마다 값을 세며 단가를 모르면 상한이 무의미해지므로 끊는다. */
    private spendOnCall(respondedModel: string, callUsage: AgentQueryUsage): void {
        const { request, pacer } = this.deps;
        if (request.maxBudgetUsd === undefined) return;
        // 폴백이 걸리면 응답이 요청 모델과 다른 모델에서 오므로 실제 응답 모델로 단가를 고른다.
        const pricedModel = respondedModel || request.model;
        const callCost = estimateCostUsd(pricedModel, callUsage);
        if (callCost === null) {
            logWarn({
                msg: "agent.query.unpriced",
                label: request.label,
                jobId: request.jobId ?? null,
                model: pricedModel,
            });
            throw new UnpricedModelError(request.label, pricedModel);
        }
        pacer.spend(callCost);
    }

    /** 도구 결과에는 도구 이름이 없어 같은 실행의 호출 식별자로 이어 붙인다. */
    private acceptToolResults(msg: Extract<SDKMessage, { type: "user" }>): void {
        const { sink, trajectory } = this.deps;
        const content = msg.message.content;
        if (typeof content === "string") return;
        for (const block of content) {
            if (block.type !== "tool_result") continue;
            const toolName = this.toolNameById.get(block.tool_use_id) ?? "";
            const text = toolResultText(block.content);
            trajectory.tool({ toolCallId: block.tool_use_id, toolName, content: text });
            sink?.onToolResult({ toolCallId: block.tool_use_id, toolName, content: text });
        }
    }

    private acceptResult(msg: Extract<SDKMessage, { type: "result" }>): void {
        const { request } = this.deps;
        reportPermissionDenials(request.label, request.jobId ?? null, msg.permission_denials);
        this.numTurns = msg.num_turns;
        this.costUsd = msg.total_cost_usd;
        this.usage = toUsage(msg.usage);
        this.actualModel = dominantModel(msg.modelUsage);
        if (msg.subtype !== "success") {
            // 공급자 사정으로 끝난 실행은 전이성 실패이므로 재시도 가능한 사유로 적어야 다시 선다.
            this.errorSubtype =
                providerSubtypeFromTerminalReason(msg.terminal_reason) ??
                normalizeClaudeResultSubtype(msg.subtype);
            this.errorSummary = `${msg.subtype}${msg.errors.length > 0 ? `: ${msg.errors.join("; ")}` : ""}`;
            this.warnOnExhaustion(msg.subtype);
            return;
        }
        this.ttftMs = msg.ttft_ms ?? null;
        if (msg.stop_reason === "max_tokens") {
            // 출력 한도에서 끊긴 답은 성공 모양으로 오지만 글이 잘려 있어 그대로 쓰면 파싱이 대신 실패한다.
            this.errorSubtype = AGENT_ERROR_SUBTYPE.maxTokens;
            this.errorSummary = "model output was truncated by the output token limit";
            this.resultText = msg.result;
            this.structuredOutput = msg.structured_output ?? null;
            return;
        }
        if (msg.stop_reason === "refusal") {
            // 안전 분류기가 거절해도 결과는 success 모양으로 오므로 stop_reason 으로 구분한다.
            this.errorSubtype = PROVIDER_ERROR_SUBTYPE.refusal;
            this.errorSummary = "model refused the request";
            return;
        }
        this.resultText = msg.result;
        this.structuredOutput = msg.structured_output ?? null;
    }

    /** 상한에 걸려 끝난 실행은 운영이 상한을 다시 정할 수 있게 쓴 값과 상한을 함께 남긴다. */
    private warnOnExhaustion(subtype: string): void {
        if (subtype !== "error_max_budget_usd" && subtype !== "error_max_turns") return;
        const { request } = this.deps;
        logWarn({
            msg: "agent.query.exhausted",
            reason: subtype,
            label: request.label,
            jobId: request.jobId ?? null,
            model: request.model,
            turns: this.numTurns,
            maxTurns: request.maxTurns,
            costUsd: this.costUsd,
            maxBudgetUsd: request.maxBudgetUsd ?? null,
        });
    }
}
