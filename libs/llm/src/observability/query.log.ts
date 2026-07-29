import { logInfo } from "@tracer-agent/platform";
import type { AgentQueryResult } from "~llm/runner/llm.runner.js";
import type { GenAiProvider } from "./semconv.const.js";

/** 언어 모델 호출 결과를 구조화된 한 줄로 남겨 비용 귀속과 계측을 함께 가능하게 한다. */
export function logAgentQuery(
    label: string,
    provider: GenAiProvider,
    model: string,
    result: AgentQueryResult,
    jobId?: string,
): void {
    const usage = result.usage;
    logInfo({
        msg: "agent.query.completed",
        label,
        provider,
        model,
        jobId: jobId ?? null,
        status: result.errorSubtype !== null ? "error" : "ok",
        errorSubtype: result.errorSubtype,
        turns: result.numTurns,
        costUsd: result.costUsd,
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        cacheReadTokens: usage?.cacheReadTokens ?? null,
        cacheCreationTokens: usage?.cacheCreationTokens ?? null,
        durationMs: result.durationMs,
    });
}
