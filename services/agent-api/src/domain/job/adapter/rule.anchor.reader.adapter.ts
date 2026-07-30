import { Inject, Injectable } from "@nestjs/common";
import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import { TRACER_API_WINDOW } from "~agent-api/config/tracer.api.token.js";
import type { RuleAnchor, RuleAnchorReaderPort } from "~agent-api/domain/job/port/rule.anchor.reader.port.js";

/** 근거가 사용자 발화인지를 가르는 이벤트 종류다. */
const USER_MESSAGE_KIND = "agent_tracer.user.message";

@Injectable()
export class RuleAnchorReaderAdapter implements RuleAnchorReaderPort {
    constructor(@Inject(TRACER_API_WINDOW) private readonly tracer: TracerApiWindow) {}

    async findById(userId: string, id: string): Promise<RuleAnchor | null> {
        const found = await this.tracer.requestOrNull({
            method: "GET",
            path: `/api/v1/events/${encodeURIComponent(id)}`,
            userId,
        });
        return toAnchor(found);
    }
}

function toAnchor(payload: unknown): RuleAnchor | null {
    if (typeof payload !== "object" || payload === null) return null;
    const event = (payload as { readonly event?: unknown }).event;
    if (typeof event !== "object" || event === null) return null;
    const row = event as { readonly id?: unknown; readonly taskId?: unknown; readonly kind?: unknown };
    if (typeof row.id !== "string" || typeof row.taskId !== "string") return null;
    return { id: row.id, taskId: row.taskId, userMessage: row.kind === USER_MESSAGE_KIND };
}
