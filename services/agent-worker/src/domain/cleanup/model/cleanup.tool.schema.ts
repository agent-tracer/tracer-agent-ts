import type { LlmToolDefinition, ToolFailureTexts } from "@tracer-agent/llm";
import { z } from "zod";

export const TASK_CLEANUP_TOOL = {
    listCandidateTasks: "list_candidate_tasks",
    getTaskEvents: "get_task_events",
} as const;

export type TaskCleanupToolName = (typeof TASK_CLEANUP_TOOL)[keyof typeof TASK_CLEANUP_TOOL];

export const EVENT_ORDER = { asc: "asc", desc: "desc" } as const;
export type EventOrder = (typeof EVENT_ORDER)[keyof typeof EVENT_ORDER];

export const DEFAULT_EVENT_ORDER: EventOrder = EVENT_ORDER.asc;
export const DEFAULT_EVENT_LIMIT = 100;
export const MAX_EVENT_LIMIT = 300;
export const DEFAULT_CANDIDATE_LIMIT = 30;
export const MAX_CANDIDATE_LIMIT = 100;

const listCandidateTasksShape = {
    limit: z.number().int().min(1).max(MAX_CANDIDATE_LIMIT).optional()
        .describe(`Max candidates in this page (default ${DEFAULT_CANDIDATE_LIMIT}, hard cap ${MAX_CANDIDATE_LIMIT})`),
    cursor: z.string().trim().min(1).optional()
        .describe("Opaque cursor from a previous call's nextCursor. Omit to start from the first candidate."),
} as const;

const getTaskEventsShape = {
    taskId: z.string().trim().min(1).describe("The task ID"),
    limit: z.number().int().min(1).max(MAX_EVENT_LIMIT).optional()
        .describe(`Max events to return in this page (default ${DEFAULT_EVENT_LIMIT}, hard cap ${MAX_EVENT_LIMIT})`),
    cursor: z.string().trim().min(1).optional()
        .describe("Opaque cursor from a previous call's nextCursor. Omit to start from the first page."),
    order: z.enum([EVENT_ORDER.asc, EVENT_ORDER.desc]).optional()
        .describe('Reading direction: "asc" (default) pages from the earliest event forward; "desc" pages from the latest event backward.'),
} as const;

const LIST_CANDIDATE_TASKS_DESCRIPTION =
    "List the cleanup candidates the server already qualified for this scan (hidden, active, and recently touched "
    + "tasks are excluded before you see them). Each entry carries visibleTitle, status, lastEventAt, hasEvents, "
    + "activeChildCount and the server-detected candidateReasons. Call this first, and page with cursor until "
    + "truncated is false if you want the whole batch. Only task ids returned here may be proposed. "
    + "moreCandidatesOutsideBatch=true means the server itself capped this batch; the leftover tasks are outside "
    + "your reach and a future scan will pick them up.";

const GET_TASK_EVENTS_DESCRIPTION =
    `Get a page of a task's chronological event sequence (user messages, assistant messages, tool runs), `
    + `up to ${MAX_EVENT_LIMIT} events per page. You choose how much to read: pick limit, pass the response's `
    + `nextCursor back as cursor to keep paging, and set order="desc" to start from the latest events (e.g. to see `
    + `how a long task ended). truncated/total tell you whether more events exist. Call this whenever you need to `
    + `see what actually happened in a task before judging it.`;

/** task-cleanup이 모델에게 노출하는 도구 계약이다. */
export const TASK_CLEANUP_TOOLS: readonly LlmToolDefinition[] = [
    {
        name: TASK_CLEANUP_TOOL.listCandidateTasks,
        description: LIST_CANDIDATE_TASKS_DESCRIPTION,
        shape: listCandidateTasksShape,
    },
    {
        name: TASK_CLEANUP_TOOL.getTaskEvents,
        description: GET_TASK_EVENTS_DESCRIPTION,
        shape: getTaskEventsShape,
    },
];

export const TASK_CLEANUP_TOOL_NAMES: readonly string[] = TASK_CLEANUP_TOOLS.map((spec) => spec.name);

export type ListCandidateTasksArgs = z.infer<z.ZodObject<typeof listCandidateTasksShape>>;
export type GetTaskEventsArgs = z.infer<z.ZodObject<typeof getTaskEventsShape>>;

export function parseListCandidateTasksArgs(raw: unknown): ListCandidateTasksArgs {
    return z.object(listCandidateTasksShape).parse(raw);
}

export function parseGetTaskEventsArgs(raw: unknown): GetTaskEventsArgs {
    return z.object(getTaskEventsShape).parse(raw);
}

/** 도구가 무너졌을 때와 검토 하나가 통째로 무너졌을 때 모델과 조율자가 읽는 문구이며 계약의 실패 픽스처가 문장을 소유한다. */
export const TASK_CLEANUP_FAILURES: ToolFailureTexts & { readonly workerFailed: string } = {
    toolFailed:
        "Tool {tool} failed: {reason}. Do not call it again more than once. "
        + "Continue with the evidence you already have, and state in your rationale "
        + "which evidence you could not check.",
    workerFailed: "Investigation failed: {reason}",
};
