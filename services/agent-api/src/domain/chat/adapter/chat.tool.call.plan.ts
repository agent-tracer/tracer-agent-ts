import { BadRequestException } from "@nestjs/common";

/** 도구 인자 하나를 계약의 요청 인자와 대화에 남길 문장으로 옮긴 결과다. */
export interface ChatToolCall {
    readonly args: Record<string, unknown>;
    describe(data: unknown): string;
}

type ChatToolPlan = (args: Record<string, unknown>) => ChatToolCall;

function plain(args: Record<string, unknown>, sentence: string): ChatToolCall {
    return { args, describe: () => sentence };
}

/** 승인 뒤 실제로 부를 자리의 인자와 그 결과 문장을 도구마다 정한다. */
export const chatToolCallPlan: Readonly<Record<string, ChatToolPlan>> = {
    update_task: (args) => {
        const taskId = req(args, "taskId");
        const title = opt(args, "title");
        const status = opt(args, "status");
        const changes: string[] = [];
        if (title !== undefined) changes.push(`title="${title}"`);
        if (status !== undefined) changes.push(`status=${status}`);
        if (changes.length === 0) throw new BadRequestException("update_task needs title or status");
        return plain(
            { taskId, ...(title !== undefined ? { title } : {}), ...(status !== undefined ? { status } : {}) },
            `Updated task ${taskId}: ${changes.join(", ")}.`,
        );
    },
    archive_task: (args) => plain({ taskId: req(args, "taskId") }, `Archived task ${req(args, "taskId")}.`),
    unarchive_task: (args) => plain({ taskId: req(args, "taskId") }, `Unarchived task ${req(args, "taskId")}.`),
    delete_task: (args) => plain({ taskId: req(args, "taskId") }, `Deleted task ${req(args, "taskId")}.`),
    create_memo: (args) => {
        const taskId = req(args, "taskId");
        const eventId = opt(args, "eventId");
        return plain(
            { taskId, body: req(args, "body"), ...(eventId !== undefined ? { eventId } : {}) },
            `Created a memo on task ${taskId}.`,
        );
    },
    update_memo: (args) => {
        const memoId = req(args, "memoId");
        return plain({ memoId, body: req(args, "body") }, `Updated memo ${memoId}.`);
    },
    delete_memo: (args) => {
        const memoId = req(args, "memoId");
        return plain({ memoId }, `Deleted memo ${memoId}.`);
    },
    create_rule: (args) => {
        const taskId = req(args, "taskId");
        const name = req(args, "name");
        const severity = opt(args, "severity");
        const rationale = opt(args, "rationale");
        return plain({
            taskId,
            anchorEventId: req(args, "anchorEventId"),
            name,
            expectation: parseJson(req(args, "expectation"), "expectation"),
            ...(severity !== undefined ? { severity } : {}),
            ...(rationale !== undefined ? { rationale } : {}),
        }, `Created rule "${name}" on task ${taskId}.`);
    },
    update_rule: (args) => {
        const ruleId = req(args, "ruleId");
        const name = opt(args, "name");
        const expectation = opt(args, "expectation");
        const severity = opt(args, "severity");
        const rationale = opt(args, "rationale");
        return plain({
            ruleId,
            ...(name !== undefined ? { name } : {}),
            ...(expectation !== undefined ? { expectation: parseJson(expectation, "expectation") } : {}),
            ...(severity !== undefined ? { severity } : {}),
            ...(rationale !== undefined ? { rationale } : {}),
        }, `Updated rule ${ruleId}.`);
    },
    delete_rule: (args) => {
        const ruleId = req(args, "ruleId");
        return plain({ ruleId }, `Deleted rule ${ruleId}.`);
    },
    approve_rule: (args) => {
        const ruleId = req(args, "ruleId");
        return {
            args: { ruleId },
            describe: (data) => `Approved rule ${ruleId} and reevaluated ${reevaluated(data)} event(s).`,
        };
    },
    reevaluate_rule: (args) => {
        const ruleId = req(args, "ruleId");
        return {
            args: { ruleId },
            describe: (data) => `Reevaluated rule ${ruleId} over ${reevaluated(data)} event(s).`,
        };
    },
    create_tag: (args) => {
        const name = req(args, "name");
        const color = opt(args, "color");
        const description = opt(args, "description");
        return plain({
            name,
            ...(color !== undefined ? { color } : {}),
            ...(description !== undefined ? { description } : {}),
        }, `Created tag "${name}".`);
    },
    update_tag: (args) => {
        const tagId = req(args, "tagId");
        const name = opt(args, "name");
        const color = opt(args, "color");
        const description = opt(args, "description");
        return plain({
            tagId,
            ...(name !== undefined ? { name } : {}),
            ...(color !== undefined ? { color } : {}),
            ...(description !== undefined ? { description } : {}),
        }, `Updated tag ${tagId}.`);
    },
    delete_tag: (args) => {
        const tagId = req(args, "tagId");
        return plain({ tagId }, `Deleted tag ${tagId}.`);
    },
    set_task_tags: (args) => {
        const taskId = req(args, "taskId");
        const tagIds = parseIdList(req(args, "tagIds"));
        return plain({ taskId, tagIds }, `Set ${tagIds.length} tag(s) on task ${taskId}.`);
    },
    accept_recipe: (args) => {
        const recipeId = req(args, "recipeId");
        return plain({ recipeId }, `Accepted recipe ${recipeId}.`);
    },
    dismiss_recipe: (args) => {
        const recipeId = req(args, "recipeId");
        return plain({ recipeId }, `Dismissed recipe ${recipeId}.`);
    },
    retire_recipe: (args) => {
        const recipeId = req(args, "recipeId");
        return plain({ recipeId }, `Retired recipe ${recipeId}.`);
    },
    accept_cleanup: (args) => {
        const suggestionId = req(args, "suggestionId");
        return plain({ suggestionId }, `Accepted cleanup suggestion ${suggestionId}.`);
    },
    dismiss_cleanup: (args) => {
        const suggestionId = req(args, "suggestionId");
        return plain({ suggestionId }, `Dismissed cleanup suggestion ${suggestionId}.`);
    },
    upsert_setting: (args) => {
        const key = req(args, "key");
        return plain({ key, value: req(args, "value") }, `Set setting ${key}.`);
    },
    delete_setting: (args) => {
        const key = req(args, "key");
        return plain({ key }, `Cleared setting ${key}.`);
    },
    enqueue_job: (args) => {
        const kind = req(args, "kind");
        return {
            args: { kind, input: parseJson(req(args, "input"), "input") },
            describe: (data) => `Enqueued ${kind} job ${jobField(data, "id")} (status: ${jobField(data, "status")}).`,
        };
    },
};

function req(args: Record<string, unknown>, key: string): string {
    const value = args[key];
    if (typeof value !== "string" || value.length === 0) throw new BadRequestException(`${key} is required`);
    return value;
}

function opt(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseJson(raw: string, label: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        throw new BadRequestException(`${label} must be a JSON object`);
    }
}

function parseIdList(raw: string): string[] {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
        const parsed = parseJson(trimmed, "tagIds");
        if (!Array.isArray(parsed)) throw new BadRequestException("tagIds must be a JSON array");
        return parsed.map(idText).filter((id) => id.length > 0);
    }
    return trimmed.length > 0 ? trimmed.split(/[\s,]+/).filter((id) => id.length > 0) : [];
}

function idText(value: unknown): string {
    return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function reevaluated(data: unknown): number {
    const value = (data as { readonly reevaluated?: unknown } | null)?.reevaluated;
    return typeof value === "number" ? value : 0;
}

function jobField(data: unknown, field: "id" | "status"): string {
    const job = (data as { readonly job?: Record<string, unknown> } | null)?.job;
    const value = job?.[field];
    return typeof value === "string" ? value : "";
}
