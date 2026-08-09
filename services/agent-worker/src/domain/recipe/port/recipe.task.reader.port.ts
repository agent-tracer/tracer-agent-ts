/** 스캔 앵커 자격 판정에 필요한 태스크 상태다. */
export interface RecipeAnchorSnapshot {
    readonly scanEligible: boolean;
    readonly sessionScanEligible: boolean;
}

/** 추적 API의 공개 경로로만 태스크를 보는 포트이며 원장이 아니므로 연결을 쥐지 않는다. */
export interface RecipeTaskReaderPort {
    findAnchor(userId: string, taskId: string): Promise<RecipeAnchorSnapshot | null>;
    findOwnedTaskIds(userId: string, taskIds: readonly string[]): Promise<readonly string[]>;
}
