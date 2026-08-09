export const CLEANUP_TASK_ARCHIVER = Symbol("CleanupTaskArchiver");

/** 태스크를 소유한 추적에 조건부 보관을 요청하며 조건이 깨지면 cleanup.stale 거절을 그대로 올린다. */
export interface CleanupTaskArchiverPort {
    archive(userId: string, taskId: string, ifNoActivitySince: Date | null): Promise<void>;
}
