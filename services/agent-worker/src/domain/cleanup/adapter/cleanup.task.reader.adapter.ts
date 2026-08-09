import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import type {
    CleanupScanBatch,
    CleanupTaskReaderPort,
} from "~agent-worker/domain/cleanup/port/cleanup.task.reader.port.js";
import { loadCleanupScanBatch } from "./cleanup.task.scan.js";

/** 태스크는 추적 API의 공개 경로에만 있으므로 이 어댑터는 원장 연결을 들지 않는다. */
export class CleanupTaskReaderAdapter implements CleanupTaskReaderPort {
    constructor(private readonly tracer: TracerApiWindow) {}

    loadScanBatch(userId: string): Promise<CleanupScanBatch> {
        return loadCleanupScanBatch(this.tracer, userId);
    }
}
