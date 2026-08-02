/** 실행 데드라인의 fraction 만큼을 밀리초 상한으로 낸다. */
export function deadlineFractionMs(deadlineMs: number, fraction: number): number {
    return Math.floor(deadlineMs * fraction);
}

/** 워커가 받은 달러 몫에 비례해 벽시계 상한을 내어 큰 몫을 받은 워커를 먼저 끊지 않는다. */
export function weightedWallClockMs(
    ceilingMs: number,
    costShare: number | undefined,
    budgetUsd: number | undefined,
    minFraction = 0.3,
): number {
    if (costShare === undefined || budgetUsd === undefined || budgetUsd <= 0) return ceilingMs;
    const fraction = costShare / budgetUsd;
    return Math.floor(ceilingMs * Math.max(Math.min(fraction, 1), minFraction));
}
