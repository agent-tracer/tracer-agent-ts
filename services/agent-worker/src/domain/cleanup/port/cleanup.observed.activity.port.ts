/** 제안이 수용 시점에 조건으로 실어 보낼 마지막 사건 시각을 추적에 묻는 포트다. */
export interface CleanupObservedActivityPort {
    lastEventAtByTask(userId: string, taskIds: readonly string[]): Promise<ReadonlyMap<string, Date>>;
}
