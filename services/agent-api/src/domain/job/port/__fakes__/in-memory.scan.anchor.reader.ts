import type { ScanAnchor, ScanAnchorReaderPort } from "~agent-api/domain/job/port/scan.anchor.reader.port.js";

/** 스캔 접수가 앵커의 자격을 묻는 창구이며 시험이 그 답을 정한다. */
export class InMemoryScanAnchorReader implements ScanAnchorReaderPort {
    private readonly rows = new Map<string, ScanAnchor>();

    seed(userId: string, ...anchors: readonly ScanAnchor[]): void {
        for (const anchor of anchors) this.rows.set(`${userId}:${anchor.id}`, anchor);
    }

    findById(userId: string, taskId: string): Promise<ScanAnchor | null> {
        return Promise.resolve(this.rows.get(`${userId}:${taskId}`) ?? null);
    }
}
