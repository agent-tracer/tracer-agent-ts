import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import { wireItems, wireText } from "~agent-worker/support/wire.value.js";
import type { CleanupObservedActivityPort } from "~agent-worker/domain/cleanup/port/cleanup.observed.activity.port.js";

/** 목록 창구 한 장이 담는 최대 개수이며 값은 계약의 태스크 집합 조회가 소유한다. */
const MAX_IDS_PER_CALL = 100;

/** 태스크는 추적 원장의 것이므로 마지막 사건 시각도 추적의 집합 조회로 읽는다. */
export class CleanupObservedActivityAdapter implements CleanupObservedActivityPort {
    constructor(private readonly tracer: TracerApiWindow) {}

    async lastEventAtByTask(userId: string, taskIds: readonly string[]): Promise<ReadonlyMap<string, Date>> {
        const found = new Map<string, Date>();
        const unique = [...new Set(taskIds)];
        for (let index = 0; index < unique.length; index += MAX_IDS_PER_CALL) {
            const chunk = unique.slice(index, index + MAX_IDS_PER_CALL);
            const page = await this.tracer.request({
                method: "GET",
                path: "/api/v1/tasks",
                userId,
                query: { ids: chunk.join(",") },
            });
            for (const item of wireItems(page)) {
                const id = wireText(item["id"]);
                const lastEventAt = wireText(item["lastEventAt"]);
                if (id === null || lastEventAt === null) continue;
                const at = new Date(lastEventAt);
                if (!Number.isNaN(at.getTime())) found.set(id, at);
            }
        }
        return found;
    }
}
