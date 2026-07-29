/** 공급자가 보고한 토큰 사용량이다. */
export interface AgentQueryUsage {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreationTokens: number;
}

/** 에이전트 한 번의 실행이 남긴 사용량 요약이다. */
export interface AgentRunSummary {
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
}
