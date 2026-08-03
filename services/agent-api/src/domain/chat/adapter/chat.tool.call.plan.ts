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

/** action 이 고른 계획을 실행하고, 자리를 고르는 쪽이 읽도록 action 을 인자에 남긴다. */
function byAction(plans: Readonly<Record<string, ChatToolPlan>>): ChatToolPlan {
    return (args) => {
        const action = req(args, "action");
        const plan = plans[action];
        if (plan === undefined) throw new BadRequestException(`${action} is not an action of this tool`);
        const call = plan(args);
        return { args: { ...call.args, action }, describe: (data) => call.describe(data) };
    };
}

const taskWrite: Readonly<Record<string, ChatToolPlan>> = {
    update: (args) => {
        const taskId = req(args, "taskId");
        const title = opt(args, "title");
        const status = opt(args, "status");
        const changes: string[] = [];
        if (title !== undefined) changes.push(`title="${title}"`);
        if (status !== undefined) changes.push(`status=${status}`);
        if (changes.length === 0) throw new BadRequestException("update needs title or status");
        return plain(
            { taskId, ...(title !== undefined ? { title } : {}), ...(status !== undefined ? { status } : {}) },
            `Updated task ${taskId}: ${changes.join(", ")}.`,
        );
    },
    archive: (args) => plain({ taskId: req(args, "taskId") }, `Archived task ${req(args, "taskId")}.`),
    unarchive: (args) => plain({ taskId: req(args, "taskId") }, `Unarchived task ${req(args, "taskId")}.`),
    delete: (args) => plain({ taskId: req(args, "taskId") }, `Deleted task ${req(args, "taskId")}.`),
};

const memoWrite: Readonly<Record<string, ChatToolPlan>> = {
    create: (args) => {
        const taskId = req(args, "taskId");
        const eventId = opt(args, "eventId");
        return plain(
            { taskId, body: req(args, "body"), ...(eventId !== undefined ? { eventId } : {}) },
            `Created a memo on task ${taskId}.`,
        );
    },
    update: (args) => {
        const memoId = req(args, "memoId");
        return plain({ memoId, body: req(args, "body") }, `Updated memo ${memoId}.`);
    },
    delete: (args) => {
        const memoId = req(args, "memoId");
        return plain({ memoId }, `Deleted memo ${memoId}.`);
    },
};

const ruleWrite: Readonly<Record<string, ChatToolPlan>> = {
    create: (args) => {
        const taskId = req(args, "taskId");
        const name = req(args, "name");
        const severity = opt(args, "severity");
        const rationale = opt(args, "rationale");
        return plain({
            taskId,
            anchorEventId: req(args, "anchorEventId"),
            name,
            expectation: reqObject(args, "expectation"),
            ...(severity !== undefined ? { severity } : {}),
            ...(rationale !== undefined ? { rationale } : {}),
        }, `Created rule "${name}" on task ${taskId}.`);
    },
    update: (args) => {
        const ruleId = req(args, "ruleId");
        const name = opt(args, "name");
        const expectation = optObject(args, "expectation");
        const severity = opt(args, "severity");
        const rationale = opt(args, "rationale");
        return plain({
            ruleId,
            ...(name !== undefined ? { name } : {}),
            ...(expectation !== undefined ? { expectation } : {}),
            ...(severity !== undefined ? { severity } : {}),
            ...(rationale !== undefined ? { rationale } : {}),
        }, `Updated rule ${ruleId}.`);
    },
    delete: (args) => plain({ ruleId: req(args, "ruleId") }, `Deleted rule ${req(args, "ruleId")}.`),
    approve: (args) => {
        const ruleId = req(args, "ruleId");
        return {
            args: { ruleId },
            describe: (data) => `Approved rule ${ruleId} and reevaluated ${reevaluated(data)} event(s).`,
        };
    },
    reevaluate: (args) => {
        const ruleId = req(args, "ruleId");
        return {
            args: { ruleId },
            describe: (data) => `Reevaluated rule ${ruleId} over ${reevaluated(data)} event(s).`,
        };
    },
};

const tagWrite: Readonly<Record<string, ChatToolPlan>> = {
    create: (args) => {
        const name = req(args, "name");
        const color = opt(args, "color");
        const description = opt(args, "description");
        return plain({
            name,
            ...(color !== undefined ? { color } : {}),
            ...(description !== undefined ? { description } : {}),
        }, `Created tag "${name}".`);
    },
    update: (args) => {
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
    delete: (args) => plain({ tagId: req(args, "tagId") }, `Deleted tag ${req(args, "tagId")}.`),
    assign: (args) => {
        const taskId = req(args, "taskId");
        const tagIds = reqIdList(args, "tagIds");
        return plain({ taskId, tagIds }, `Set ${tagIds.length} tag(s) on task ${taskId}.`);
    },
};

const recipeWrite: Readonly<Record<string, ChatToolPlan>> = {
    accept: (args) => plain({ recipeId: req(args, "recipeId") }, `Accepted recipe ${req(args, "recipeId")}.`),
    dismiss: (args) => plain({ recipeId: req(args, "recipeId") }, `Dismissed recipe ${req(args, "recipeId")}.`),
    retire: (args) => plain({ recipeId: req(args, "recipeId") }, `Retired recipe ${req(args, "recipeId")}.`),
};

const cleanupWrite: Readonly<Record<string, ChatToolPlan>> = {
    accept: (args) =>
        plain({ suggestionId: req(args, "suggestionId") }, `Accepted cleanup suggestion ${req(args, "suggestionId")}.`),
    dismiss: (args) =>
        plain({ suggestionId: req(args, "suggestionId") }, `Dismissed cleanup suggestion ${req(args, "suggestionId")}.`),
};

/** 승인 뒤 실제로 부를 자리의 인자와 그 결과 문장을 도구마다 정한다. */
export const chatToolCallPlan: Readonly<Record<string, ChatToolPlan>> = {
    remember_fact: (args) => {
        const key = req(args, "key");
        return plain({ key, content: req(args, "content") }, `Remembered "${key}" about you.`);
    },
    enqueue_job: (args) => {
        const kind = req(args, "kind");
        return {
            args: { kind, input: reqObject(args, "input") },
            describe: (data) => `Enqueued ${kind} job ${jobField(data, "id")} (status: ${jobField(data, "status")}).`,
        };
    },
    propose_task_write: byAction(taskWrite),
    propose_memo_write: byAction(memoWrite),
    propose_rule_write: byAction(ruleWrite),
    propose_tag_write: byAction(tagWrite),
    propose_recipe_write: byAction(recipeWrite),
    propose_cleanup_write: byAction(cleanupWrite),
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

function optObject(args: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
    const value = args[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "object" || Array.isArray(value)) {
        throw new BadRequestException(`${key} must be a JSON object`);
    }
    return value as Record<string, unknown>;
}

function reqObject(args: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = optObject(args, key);
    if (value === undefined) throw new BadRequestException(`${key} is required`);
    return value;
}

function reqIdList(args: Record<string, unknown>, key: string): string[] {
    const value = args[key];
    if (!Array.isArray(value)) throw new BadRequestException(`${key} must be a JSON array`);
    return value.filter((id): id is string => typeof id === "string" && id.length > 0);
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
