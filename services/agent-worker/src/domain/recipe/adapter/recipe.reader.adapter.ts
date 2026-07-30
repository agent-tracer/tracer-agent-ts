import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import {
    wireDate,
    wireItems,
    wireNumber,
    wireObject,
    wireText,
    wireTexts,
} from "~agent-worker/support/wire.value.js";
import type {
    RecipeEvent,
    RecipeEventReaderPort,
    RecipeRule,
    RecipeRuleExpectation,
    RecipeRuleReaderPort,
    RecipeTask,
    RecipeTaskReaderPort,
} from "~agent-worker/domain/recipe/port/recipe.reader.port.js";

const TIMELINE_ORDER = { asc: "asc", desc: "desc" } as const;

/** 태스크와 이벤트와 규칙을 추적 API의 조회 창구에서 레시피 도구 표현으로 읽는다. */
export class RecipeReaderAdapter
    implements RecipeTaskReaderPort, RecipeEventReaderPort, RecipeRuleReaderPort
{
    constructor(private readonly tracer: TracerApiWindow) {}

    async findById(userId: string, taskId: string): Promise<RecipeTask | null> {
        const found = await this.tracer.requestOrNull({
            method: "GET",
            path: `/api/v1/tasks/${encodeURIComponent(taskId)}`,
            userId,
        });
        if (found === null) return null;
        const task = wireObject(wireObject(found)["task"]);
        return {
            id: wireText(task["id"]) ?? taskId,
            title: wireText(task["title"]) ?? "",
            status: wireText(task["status"]) ?? "",
            taskKind: wireText(task["taskKind"]) ?? "",
            workspacePath: wireText(task["workspacePath"]),
            createdAt: wireDate(task["createdAt"]),
            updatedAt: wireDate(task["updatedAt"]),
        };
    }

    findTimeline(
        userId: string,
        taskId: string,
        cursor: { readonly seq: string } | undefined,
        limit: number,
    ): Promise<readonly RecipeEvent[]> {
        return this.readTimeline(userId, taskId, TIMELINE_ORDER.asc, cursor?.seq, limit);
    }

    findTimelineWindow(
        userId: string,
        taskId: string,
        cursor: string | undefined,
        limit: number,
    ): Promise<readonly RecipeEvent[]> {
        return this.readTimeline(userId, taskId, TIMELINE_ORDER.desc, cursor, limit);
    }

    async countByTask(userId: string, taskId: string): Promise<number> {
        const page = await this.timeline(userId, taskId, TIMELINE_ORDER.asc, undefined, 1);
        return wireNumber(wireObject(page)["total"]) ?? 0;
    }

    async findApplicable(userId: string, taskId: string): Promise<readonly RecipeRule[]> {
        const found = await this.tracer.request({
            method: "GET",
            path: "/api/v1/rules",
            userId,
            query: { taskId },
        });
        return wireItems(found).map(toRule);
    }

    private async readTimeline(
        userId: string,
        taskId: string,
        order: string,
        cursor: string | undefined,
        limit: number,
    ): Promise<readonly RecipeEvent[]> {
        const page = await this.timeline(userId, taskId, order, cursor, limit);
        return wireItems(page).map(toEvent);
    }

    private timeline(
        userId: string,
        taskId: string,
        order: string,
        cursor: string | undefined,
        limit: number,
    ): Promise<unknown> {
        return this.tracer.request({
            method: "GET",
            path: `/api/v1/tasks/${encodeURIComponent(taskId)}/timeline`,
            userId,
            query: { order, limit, ...(cursor !== undefined ? { cursor } : {}) },
        });
    }
}

function toEvent(item: Record<string, unknown>): RecipeEvent {
    return {
        id: wireText(item["id"]) ?? "",
        seq: wireText(item["seq"]) ?? String(wireNumber(item["seq"]) ?? 0),
        turnId: wireText(item["turnId"]),
        kind: wireText(item["kind"]) ?? "",
        title: wireText(item["title"]) ?? "",
        body: wireText(item["body"]),
        toolName: wireText(item["toolName"]),
        filePaths: wireTexts(item["filePaths"]),
        metadata: wireObject(item["metadata"]),
        occurredAt: wireDate(item["occurredAt"]),
    };
}

function toRule(item: Record<string, unknown>): RecipeRule {
    return {
        id: wireText(item["id"]) ?? "",
        name: wireText(item["name"]) ?? "",
        expectation: toExpectation(item["expectation"]),
        taskId: wireText(item["taskId"]) ?? "",
        anchorEventId: wireText(item["anchorEventId"]) ?? "",
        source: wireText(item["source"]) ?? "",
        severity: wireText(item["severity"]) ?? "",
        rationale: wireText(item["rationale"]),
        signature: wireText(item["signature"]) ?? "",
        createdAt: wireDate(item["createdAt"]),
    };
}

function toExpectation(value: unknown): RecipeRuleExpectation {
    const expectation = wireObject(value);
    const tool = wireText(expectation["tool"]);
    switch (wireText(expectation["kind"])) {
        case "command":
            return { kind: "command", commandMatches: wireTexts(expectation["commandMatches"]) };
        case "action":
            return { kind: "action", tool: tool ?? "" };
        default:
            return {
                kind: "pattern",
                pattern: wireText(expectation["pattern"]) ?? "",
                ...(tool !== null ? { tool } : {}),
            };
    }
}
