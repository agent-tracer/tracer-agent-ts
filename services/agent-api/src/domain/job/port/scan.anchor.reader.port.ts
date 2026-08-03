import type { ScanAnchorFacts } from "~agent-api/domain/job/model/scan.anchor.contract.js";

export const SCAN_ANCHOR_READER = Symbol("ScanAnchorReader");

/** 스캔이 근거를 수집할 태스크 하나이며 자격 판정에 쓰는 세 값을 든다. */
export interface ScanAnchor extends ScanAnchorFacts {
    readonly id: string;
}

/** 스캔 접수가 앵커의 자격을 확인하려고 읽는 포트이며 남의 태스크는 없는 것으로 본다. */
export interface ScanAnchorReaderPort {
    findById(userId: string, taskId: string): Promise<ScanAnchor | null>;
}
