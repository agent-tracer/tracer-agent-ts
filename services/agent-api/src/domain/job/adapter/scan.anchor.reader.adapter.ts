import { Inject, Injectable } from "@nestjs/common";
import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import { TRACER_API_WINDOW } from "~agent-api/config/tracer.api.token.js";
import type { ScanAnchor, ScanAnchorReaderPort } from "~agent-api/domain/job/port/scan.anchor.reader.port.js";

@Injectable()
export class ScanAnchorReaderAdapter implements ScanAnchorReaderPort {
    constructor(@Inject(TRACER_API_WINDOW) private readonly tracer: TracerApiWindow) {}

    async findById(userId: string, taskId: string): Promise<ScanAnchor | null> {
        const found = await this.tracer.requestOrNull({
            method: "GET",
            path: `/api/v1/tasks/${encodeURIComponent(taskId)}`,
            userId,
        });
        return toAnchor(found);
    }
}

function toAnchor(payload: unknown): ScanAnchor | null {
    if (typeof payload !== "object" || payload === null) return null;
    const task = (payload as { readonly task?: unknown }).task;
    if (typeof task !== "object" || task === null) return null;
    const row = task as {
        readonly id?: unknown;
        readonly origin?: unknown;
        readonly status?: unknown;
        readonly parentTaskId?: unknown;
    };
    if (typeof row.id !== "string") return null;
    return {
        id: row.id,
        origin: typeof row.origin === "string" ? row.origin : null,
        root: row.parentTaskId === null || row.parentTaskId === undefined,
        status: typeof row.status === "string" ? row.status : null,
    };
}
