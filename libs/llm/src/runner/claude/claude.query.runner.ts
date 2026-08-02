import { query, SYSTEM_PROMPT_DYNAMIC_BOUNDARY, type HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import { AGENT_ERROR_SUBTYPE, PROVIDER_ERROR_SUBTYPE } from "~llm/model/agent.error.js";
import type { AgentQueryUsage } from "~llm/model/agent.usage.js";
import { createAgentDeadline, DeadlineExceededError } from "~llm/model/deadline.js";
import type { JobStepToolCall } from "~llm/model/job.step.js";
import { logAgentQuery } from "~llm/observability/query.log.js";
import { GEN_AI_PROVIDER } from "~llm/observability/semconv.const.js";
import { withGenAiClientTelemetry } from "~llm/observability/telemetry.js";
import { TrajectoryRecorder } from "~llm/observability/trajectory.js";
import { estimateCostUsd } from "~llm/pricing/pricing.js";
import { landingDirective } from "~llm/runner/landing.directive.js";
import type { AgentQueryRequest, AgentQueryResult, IQueryRunner } from "~llm/runner/llm.runner.js";
import { redactText } from "~llm/support/redaction.js";
import { logWarn } from "@tracer-agent/platform";
import { buildAgentEnv } from "./claude.env.js";
import { ProcessErrorOutput } from "./claude.process.error.js";
import { resolveClaudeExecutablePath } from "./claude.executable.js";
import {
    dominantModel,
    normalizeClaudeResultSubtype,
    toToolArgs,
    toolResultText,
    toUsage,
} from "./claude.query.mappers.js";
import type { ClaudeQueryOptions } from "./claude.query.options.js";
import { partialAssistantDeltaText } from "./claude.stream.delta.js";
import { createClaudeRunTree, finishClaudeRunTree } from "./claude.trace.js";

/** Claude Agent SDK로 도구 사용 질의를 실행한다. */
export class ClaudeQueryRunner implements IQueryRunner<ClaudeQueryOptions> {
    // 로컬 CLI 인증 프로파일은 별도 지정이 없으면 개발 추적의 원문 공개도 함께 활성화한다.
    constructor(
        private readonly useLocalCliAuth = false,
        private readonly discloseTracePayloads = useLocalCliAuth,
        private readonly nowMs: () => number = () => Date.now(),
    ) {}

    requiresLocalApiKey(): boolean {
        return !this.useLocalCliAuth;
    }

    async run(request: AgentQueryRequest<ClaudeQueryOptions>): Promise<AgentQueryResult> {
        return withGenAiClientTelemetry(
            {
                model: request.model,
                provider: GEN_AI_PROVIDER.anthropic,
                ...(request.jobId !== undefined ? { jobId: request.jobId } : {}),
                ...(request.observation !== undefined ? { observation: request.observation } : {}),
            },
            () => this.runQuery(request),
        );
    }

    private async runQuery(request: AgentQueryRequest<ClaudeQueryOptions>): Promise<AgentQueryResult> {
        const startedAt = this.nowMs();
        const runTree = await createClaudeRunTree(request, this.discloseTracePayloads);
        let collected = "";
        let resultText = "";
        let structuredOutput: unknown = null;
        let numTurns: number | null = null;
        let costUsd: number | null = null;
        let usage: AgentQueryUsage | null = null;
        let errorSummary: string | null = null;
        let errorSubtype: string | null = null;
        let actualModel: string | null = null;
        let providerRequestId: string | null = null;
        const stderr = new ProcessErrorOutput();
        const trajectory = new TrajectoryRecorder(this.nowMs);
        const toolNameById = new Map<string, string>();

        const deadline = createAgentDeadline(request.deadlineMs);
        if (request.parentSignal) {
            if (request.parentSignal.aborted) deadline.controller.abort();
            else {
                request.parentSignal.addEventListener("abort", () => deadline.controller.abort(), { once: true });
            }
        }

        // 이미 태운 비용에 지금까지 가장 비쌌던 호출을 한 번 더 더해도 예산을 감당하는지로 다음 호출 가능 여부를 예측한다.
        let runningCostUsd = 0;
        let peakCallCostUsd = 0;
        let landing = false;
        // continue:false는 루프를 멈춰 결론 턴을 잃으므로 그 도구만 막아 모델이 남은 것으로 결론을 내게 한다.
        const landingReason = landingDirective(request.outputSchema !== undefined);
        const denyToolsWhenLanding = (): Promise<HookJSONOutput> =>
            Promise.resolve(
                landing
                    ? {
                        hookSpecificOutput: {
                            hookEventName: "PreToolUse",
                            permissionDecision: "deny",
                            permissionDecisionReason: landingReason,
                        },
                    }
                    : { continue: true },
            );

        const options = request.providerOptions;
        const systemPrompt = buildSystemPrompt(request, options);
        const executablePath = resolveClaudeExecutablePath();

        const stream = query({
            prompt: request.prompt,
            options: {
                ...(executablePath !== undefined ? { pathToClaudeCodeExecutable: executablePath } : {}),
                abortController: deadline.controller,
                ...(options?.cwd !== undefined ? { cwd: options.cwd } : {}),
                ...(options?.mcpServers !== undefined ? { mcpServers: options.mcpServers } : {}),
                model: request.model,
                // allowedTools는 자동 승인 목록이고 tools는 사용 가능한 빌트인 도구 집합이다.
                allowedTools: [...request.allowedTools],
                tools: [...(options?.builtInTools ?? [])],
                maxTurns: request.maxTurns,
                systemPrompt,
                ...(request.outputSchema !== undefined
                    ? { outputFormat: { type: "json_schema" as const, schema: request.outputSchema } }
                    : {}),
                // 봉투가 정한 출력 한도를 CLI 는 질의 옵션이 아니라 이 환경변수로만 받는다.
                env: buildAgentEnv({
                    ...request.env,
                    IS_SANDBOX: "1",
                    ...(request.maxOutputTokens !== undefined
                        ? { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(request.maxOutputTokens) }
                        : {}),
                }),
                // 승인 프롬프트 없이 실행하므로 호출자는 읽기 전용 도구만 허용해야 한다.
                permissionMode: "bypassPermissions",
                allowDangerouslySkipPermissions: true,
                strictMcpConfig: true,
                includePartialMessages: request.stream !== undefined,
                persistSession: false,
                // 운영에서는 컨테이너의 CLI 설정과 스킬이 실행 표면을 바꾸지 못하게 둘 다 비운다.
                settingSources: this.useLocalCliAuth ? ["user"] : [],
                skills: this.useLocalCliAuth ? "all" : [],
                ...(request.effort !== undefined ? { effort: request.effort } : {}),
                ...(request.maxBudgetUsd !== undefined ? { maxBudgetUsd: request.maxBudgetUsd } : {}),
                ...(options?.fallbackModel !== undefined ? { fallbackModel: options.fallbackModel } : {}),
                stderr: (data) => stderr.append(data),
                hooks: { PreToolUse: [{ hooks: [denyToolsWhenLanding] }] },
            },
        });

        const sink = request.stream;
        try {
            for await (const msg of stream) {
                // 부분 메시지가 켜졌을 때만 나오며 어시스턴트 텍스트 조각을 도착하는 대로 흘려보낸다.
                if (msg.type === "stream_event") {
                    if (sink !== undefined) {
                        // 사고 블록과 도구 인자 스트리밍은 텍스트를 안 내지만 실행이 나아가고 있다는 신호다.
                        sink.onProgress?.();
                        const delta = partialAssistantDeltaText(msg.event);
                        if (delta.length > 0) sink.onAssistantDelta(delta);
                    }
                    continue;
                }
                if (msg.type === "assistant") {
                    // 공급자 식별자는 모델 호출 하나를 가리키므로 마지막 호출의 값이 이 시도를 대표한다.
                    if (msg.request_id !== undefined) providerRequestId = msg.request_id;
                    let text = "";
                    const toolCalls: JobStepToolCall[] = [];
                    for (const block of msg.message.content) {
                        if (block.type === "text") text += block.text;
                        if (block.type === "tool_use") {
                            const args = toToolArgs(block.input);
                            toolCalls.push({ id: block.id, name: block.name, args });
                            toolNameById.set(block.id, block.name);
                            sink?.onToolCall({ id: block.id, name: block.name, args });
                        }
                    }
                    collected += text;
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
                    if (request.maxBudgetUsd !== undefined) {
                        // 폴백이 걸리면 실제 응답 모델이 요청 모델과 달라질 수 있어 이 추정은 근사다.
                        const callCost = estimateCostUsd(request.model, callUsage) ?? 0;
                        runningCostUsd += callCost;
                        peakCallCostUsd = Math.max(peakCallCostUsd, callCost);
                        landing = runningCostUsd + peakCallCostUsd >= request.maxBudgetUsd;
                    }
                    continue;
                }
                // 도구 결과에는 도구 이름이 없어 같은 실행의 호출 ID로 이어 붙인다.
                if (msg.type === "user") {
                    const content = msg.message.content;
                    if (typeof content === "string") continue;
                    for (const block of content) {
                        if (block.type !== "tool_result") continue;
                        const toolName = toolNameById.get(block.tool_use_id) ?? "";
                        const text = toolResultText(block.content);
                        trajectory.tool({ toolCallId: block.tool_use_id, toolName, content: text });
                        sink?.onToolResult({ toolCallId: block.tool_use_id, toolName, content: text });
                    }
                    continue;
                }
                if (msg.type === "result") {
                    numTurns = msg.num_turns;
                    costUsd = msg.total_cost_usd;
                    usage = toUsage(msg.usage);
                    actualModel = dominantModel(msg.modelUsage);
                    if (msg.subtype === "success" && msg.stop_reason !== "refusal") {
                        resultText = msg.result;
                        structuredOutput = msg.structured_output ?? null;
                    } else if (msg.subtype === "success") {
                        // 안전 분류기가 거절해도 결과는 success 모양으로 오므로 stop_reason으로 가른다.
                        errorSubtype = PROVIDER_ERROR_SUBTYPE.refusal;
                        errorSummary = "model refused the request";
                    } else {
                        errorSubtype = normalizeClaudeResultSubtype(msg.subtype);
                        errorSummary = `${msg.subtype}${msg.errors.length > 0 ? `: ${msg.errors.join("; ")}` : ""}`;
                        if (msg.subtype === "error_max_budget_usd" || msg.subtype === "error_max_turns") {
                            logWarn({
                                msg: "agent.query.exhausted",
                                reason: msg.subtype,
                                label: request.label,
                                jobId: request.jobId ?? null,
                                model: request.model,
                                turns: numTurns,
                                maxTurns: request.maxTurns,
                                costUsd,
                                maxBudgetUsd: request.maxBudgetUsd ?? null,
                            });
                        }
                    }
                    break;
                }
            }
        } catch (err) {
            const reason: unknown = deadline.controller.signal.reason;
            if (deadline.controller.signal.aborted && reason instanceof DeadlineExceededError) {
                errorSubtype = AGENT_ERROR_SUBTYPE.deadlineExceeded;
                errorSummary = reason.message;
            } else if (deadline.controller.signal.aborted) {
                errorSubtype = AGENT_ERROR_SUBTYPE.cancelled;
                errorSummary = "query aborted (parent signal or external cancellation)";
            } else {
                errorSubtype = AGENT_ERROR_SUBTYPE.processError;
                errorSummary = redactText(err instanceof Error ? err.message : String(err));
            }
        } finally {
            deadline.dispose();
        }

        const result: AgentQueryResult = {
            rawOutput: resultText || collected,
            structuredOutput,
            durationMs: this.nowMs() - startedAt,
            numTurns,
            costUsd,
            usage,
            steps: trajectory.snapshot(),
            errorSummary,
            errorSubtype,
            landed: landing,
            actualModel,
            providerRequestId,
        };

        if (runTree) {
            await finishClaudeRunTree(runTree, resultText || collected, structuredOutput, errorSummary);
        }

        stderr.report(request.label, request.jobId ?? null, errorSubtype);
        logAgentQuery(request.label, GEN_AI_PROVIDER.anthropic, request.model, result, request.jobId);
        return result;
    }
}

/** 지침을 정적 접두부와 턴별 맥락으로 나누어 앞쪽만 프롬프트 캐시에 남게 한다. */
function buildSystemPrompt(
    request: AgentQueryRequest<ClaudeQueryOptions>,
    options: ClaudeQueryOptions | undefined,
): string | string[] | { type: "preset"; preset: "claude_code"; append: string; excludeDynamicSections?: boolean } {
    const dynamic = request.dynamicSystemPrompt;
    if (options?.useClaudeCodePreset === true) {
        return {
            type: "preset" as const,
            preset: "claude_code" as const,
            append: dynamic === undefined ? request.systemPrompt : `${request.systemPrompt}\n\n${dynamic}`,
            ...(options.excludeDynamicSections === true ? { excludeDynamicSections: true } : {}),
        };
    }
    if (dynamic === undefined) return request.systemPrompt;
    return [request.systemPrompt, SYSTEM_PROMPT_DYNAMIC_BOUNDARY, dynamic];
}
