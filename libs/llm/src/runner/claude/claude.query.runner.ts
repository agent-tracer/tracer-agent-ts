import { query } from "@anthropic-ai/claude-agent-sdk";
import { createAgentDeadline } from "~llm/model/deadline.js";
import { logAgentQuery } from "~llm/observability/query.log.js";
import { GEN_AI_PROVIDER } from "~llm/observability/semconv.const.js";
import { withGenAiClientTelemetry } from "~llm/observability/telemetry.js";
import { TrajectoryRecorder } from "~llm/observability/trajectory.js";
import { LandingPacer } from "~llm/runner/landing.pacer.js";
import type { AgentQueryRequest, AgentQueryResult, IQueryRunner } from "~llm/runner/llm.runner.js";
import { ClaudeMessageReducer } from "./claude.message.reducer.js";
import { buildClaudeQueryOptions } from "./claude.query.options.builder.js";
import { classifyQueryFailure, type QueryFailure } from "./claude.query.failure.js";
import { ProcessErrorOutput } from "./claude.process.error.js";
import type { ClaudeQueryOptions } from "./claude.query.options.js";
import { toolPacingHook } from "./tool.pacing.hook.js";
import { createClaudeRunTree, finishClaudeRunTree } from "./claude.trace.js";

/** Claude Agent SDK로 도구 사용 질의를 실행한다. */
export class ClaudeQueryRunner implements IQueryRunner<ClaudeQueryOptions> {
    // 인증 방식과 추적 원문 공개는 다른 결정이므로 공개는 부르는 쪽이 켜야 켜진다.
    constructor(
        private readonly useLocalCliAuth = false,
        private readonly discloseTracePayloads = false,
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
        let failure: QueryFailure | null = null;
        const stderr = new ProcessErrorOutput();
        const trajectory = new TrajectoryRecorder(this.nowMs);

        const deadline = createAgentDeadline(request.deadlineMs);
        if (request.parentSignal) {
            if (request.parentSignal.aborted) deadline.controller.abort();
            else {
                request.parentSignal.addEventListener("abort", () => deadline.controller.abort(), { once: true });
            }
        }

        // 이미 실행한 비용에 계약이 정한 마무리 몫을 더해도 예산 안에 드는지로 다음 호출 가능 여부를 예측한다.
        const pacer = new LandingPacer(request.maxTurns, request.maxBudgetUsd);
        const paceToolUse = toolPacingHook({
            landing: () => pacer.isLanding,
            modelTurns: () => pacer.modelTurns,
            maxTurns: request.maxTurns,
            hasOutputSchema: request.outputSchema !== undefined,
        });

        // 하위 프로세스 기동과 MCP 초기화가 이 지점과 첫 메시지 사이에 들어가며 ttft_ms 로는 갈라지지 않는다.
        const queryOpenedAt = this.nowMs();
        const stream = query({
            prompt: request.prompt,
            options: buildClaudeQueryOptions({
                request,
                abortController: deadline.controller,
                paceToolUse,
                onStderr: (data) => stderr.append(data),
                useLocalCliAuth: this.useLocalCliAuth,
            }),
        });

        const reducer = new ClaudeMessageReducer({
            request,
            trajectory,
            pacer,
            sink: request.stream,
        });
        let startupMs: number | null = null;
        try {
            for await (const msg of stream) {
                startupMs ??= this.nowMs() - queryOpenedAt;
                if (!reducer.acceptAndContinue(msg)) break;
            }
        } catch (err) {
            failure = classifyQueryFailure(err, deadline.controller.signal);
        } finally {
            deadline.dispose();
        }

        const reduced = reducer.snapshot();
        const result: AgentQueryResult = {
            ...reduced,
            durationMs: this.nowMs() - startedAt,
            steps: trajectory.snapshot(),
            // 던져진 실패는 결과 메시지를 받지 못한 것이므로 접어 낸 사유보다 앞선다.
            errorSummary: failure?.errorSummary ?? reduced.errorSummary,
            errorSubtype: failure?.errorSubtype ?? reduced.errorSubtype,
            landed: pacer.isLanding,
            startupMs,
        };

        if (runTree) {
            await finishClaudeRunTree(runTree, result.rawOutput, result.structuredOutput, result.errorSummary);
        }

        stderr.report(request.label, request.jobId ?? null, result.errorSubtype);
        logAgentQuery(request.label, GEN_AI_PROVIDER.anthropic, request.model, result, request.jobId);
        return result;
    }
}
