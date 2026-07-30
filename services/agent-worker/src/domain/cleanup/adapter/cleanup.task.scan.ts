import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import { wireItems, wireNumber, wireObject, wireText } from "~agent-worker/support/wire.value.js";
import type { CleanupTaskSnapshot } from "~agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import type { CleanupScanBatch } from "~agent-worker/domain/cleanup/port/cleanup.repository.port.js";

/** 서버 자신의 에이전트가 만든 태스크를 나타내는 출처 값이며 정리 대상에서 뺀다. */
const SERVER_SDK_TASK_ORIGIN = "server-sdk";

/** 한 번의 스캔이 훑는 태스크의 상한이다. */
const TASK_SCAN_LIMIT = 500;

/** 목록 창구가 한 장에 담는 최대 개수이며 값은 추적 API가 소유한다. */
const TASK_PAGE_LIMIT = 100;

/** 자식이 아직 살아 있다고 보는 태스크 상태다. */
const ACTIVE_TASK_STATUSES = ["running", "waiting"] as const;

/** 정리 후보 판정에 들어가는 태스크 배치를 추적 API의 목록 창구에서 모은다. */
export async function loadCleanupScanBatch(
    tracer: TracerApiWindow,
    userId: string,
): Promise<CleanupScanBatch> {
    const visible = await readPages(tracer, userId, { archived: "false" }, TASK_SCAN_LIMIT + 1);
    const truncated = visible.length > TASK_SCAN_LIMIT;
    const limited = truncated ? visible.slice(0, TASK_SCAN_LIMIT) : visible;
    const userTasks = limited.filter((task) => wireText(task["origin"]) !== SERVER_SDK_TASK_ORIGIN);

    const owned = new Set(userTasks.map((task) => wireText(task["id"])));
    const activeChildParentIds: string[] = [];
    for (const status of ACTIVE_TASK_STATUSES) {
        const active = await readPages(tracer, userId, { status }, TASK_SCAN_LIMIT);
        for (const child of active) {
            const parentTaskId = wireText(child["parentTaskId"]);
            if (parentTaskId !== null && owned.has(parentTaskId)) activeChildParentIds.push(parentTaskId);
        }
    }

    return {
        tasks: userTasks.map(toTaskSnapshot),
        activeChildParentIds,
        truncated,
        tasksScanned: userTasks.length,
    };
}

async function readPages(
    tracer: TracerApiWindow,
    userId: string,
    filter: Readonly<Record<string, string>>,
    cap: number,
): Promise<readonly Record<string, unknown>[]> {
    const collected: Record<string, unknown>[] = [];
    let cursor: string | undefined;
    do {
        const page = await tracer.request({
            method: "GET",
            path: "/api/v1/tasks",
            userId,
            query: { ...filter, limit: TASK_PAGE_LIMIT, ...(cursor !== undefined ? { cursor } : {}) },
        });
        collected.push(...wireItems(page));
        cursor = wireText(wireObject(page)["nextCursor"]) ?? undefined;
    } while (cursor !== undefined && collected.length < cap);
    return collected.slice(0, cap);
}

function toTaskSnapshot(task: Record<string, unknown>): CleanupTaskSnapshot {
    return {
        id: wireText(task["id"]) ?? "",
        title: wireText(task["title"]) ?? "",
        status: wireText(task["status"]) ?? "",
        lastEventAt: wireText(task["lastEventAt"]),
        updatedAt: wireText(task["updatedAt"]) ?? new Date(wireNumber(task["updatedAt"]) ?? 0).toISOString(),
    };
}
