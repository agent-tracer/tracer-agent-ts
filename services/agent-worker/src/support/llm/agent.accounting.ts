import { AgentExecutionFailure, type AgentQueryUsage } from "@tracer-agent/llm";

/** 한 번의 호출이 남긴 회계이며 실행 단위로 합산될 수 있다. */
export interface AgentCallAccounting {
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
}

/** 여러 호출의 회계를 durationMs는 항상 더하고 나머지는 값이 전부 없을 때만 null로 합친다. */
export function mergeAgentCallAccounting(calls: readonly AgentCallAccounting[]): AgentCallAccounting {
    return {
        durationMs: calls.reduce((sum, call) => sum + call.durationMs, 0),
        costUsd: sumKnown(calls.map((call) => call.costUsd)),
        numTurns: sumKnown(calls.map((call) => call.numTurns)),
        usage: mergeUsage(calls.map((call) => call.usage)),
    };
}

function sumKnown(values: readonly (number | null)[]): number | null {
    const known = values.filter((value): value is number => value !== null);
    return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
}

function mergeUsage(values: readonly (AgentQueryUsage | null)[]): AgentQueryUsage | null {
    const known = values.filter((value): value is AgentQueryUsage => value !== null);
    if (known.length === 0) return null;
    return known.reduce(
        (sum, usage) => ({
            inputTokens: sum.inputTokens + usage.inputTokens,
            outputTokens: sum.outputTokens + usage.outputTokens,
            cacheReadTokens: sum.cacheReadTokens + usage.cacheReadTokens,
            cacheCreationTokens: sum.cacheCreationTokens + usage.cacheCreationTokens,
        }),
        { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
    );
}

// 실패한 호출의 실제 지출은 알 수 없으므로 settle()의 null 처리가 예약해 준 몫을 전부 쓴 것으로
// 보수적으로 간주하도록 costUsd와 numTurns를 비워 둔다.
export function agentFailureAccounting(error: unknown): AgentCallAccounting {
    return {
        durationMs: error instanceof AgentExecutionFailure ? (error.durationMs ?? 0) : 0,
        costUsd: null,
        numTurns: null,
        usage: error instanceof AgentExecutionFailure ? error.usage : null,
    };
}
