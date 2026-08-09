import type { CleanupTaskSnapshot } from "~agent-worker/domain/cleanup/model/cleanup.candidate.model.js";

/** 후보 판정에 들어가는 이번 스캔의 태스크 배치다. */
export interface CleanupScanBatch {
    readonly tasks: readonly CleanupTaskSnapshot[];
    /** 상한 없이 조회한 활성 자식의 부모 태스크 ID다. */
    readonly activeChildParentIds: readonly string[];
    /** 조회 상한에 걸려 배치가 태스크 전체를 담지 못했는지 여부다. */
    readonly truncated: boolean;
    /** 후보로 좁히기 전 이번 스캔이 조회한 태스크 수다. */
    readonly tasksScanned: number;
}

/** 추적 API의 공개 경로로만 태스크를 보는 포트이며 원장이 아니므로 연결을 쥐지 않는다. */
export interface CleanupTaskReaderPort {
    /** 사용자에게 보이는 태스크만 골라 후보 판정 입력을 만든다. */
    loadScanBatch(userId: string): Promise<CleanupScanBatch>;
}
