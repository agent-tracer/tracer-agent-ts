import type { LlmToolDefinition, ToolFailureTexts } from "@tracer-agent/llm";
import { z } from "zod";

export const TITLE_SUGGESTION_TOOL = {
    getTaskEvents: "get_task_events",
} as const;

export type TitleSuggestionToolName =
    (typeof TITLE_SUGGESTION_TOOL)[keyof typeof TITLE_SUGGESTION_TOOL];

export const EVENT_ORDER = { asc: "asc", desc: "desc" } as const;

export type EventOrder = (typeof EVENT_ORDER)[keyof typeof EVENT_ORDER];

export const DEFAULT_EVENT_LIMIT = 100;
export const MIN_EVENT_LIMIT = 1;
export const MAX_EVENT_LIMIT = 300;
export const DEFAULT_EVENT_ORDER: EventOrder = EVENT_ORDER.asc;

const getTaskEventsShape = {
    taskId: z.string().trim().min(1).describe("The task ID"),
    limit: z
        .number()
        .int()
        .min(MIN_EVENT_LIMIT)
        .max(MAX_EVENT_LIMIT)
        .optional()
        .describe(
            `Max events to return in this page (default ${DEFAULT_EVENT_LIMIT}, hard cap ${MAX_EVENT_LIMIT})`,
        ),
    cursor: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe("Opaque cursor from a previous call's nextCursor. Omit to start from the first page."),
    order: z
        .enum([EVENT_ORDER.asc, EVENT_ORDER.desc])
        .optional()
        .describe(
            'Reading direction: "asc" (default) pages from the earliest event forward; "desc" pages from the latest event backward.',
        ),
} as const;

const GET_TASK_EVENTS_DESCRIPTION =
    `Get a page of a task's chronological event sequence (user messages, assistant messages, tool runs), `
    + `up to ${MAX_EVENT_LIMIT} events per page. You choose how much to read: pick limit, pass the response's `
    + `nextCursor back as cursor to keep paging, and set order="desc" to start from the latest events (e.g. to see `
    + `how a long task ended). truncated/total tell you whether more events exist. Call this when the conversation `
    + `excerpt in the prompt is too thin to name the work.`;

/** 이 에이전트가 모델에게 여는 도구 계약이며 목록은 계약의 tools가 소유한다. */
export const TITLE_SUGGESTION_TOOLS: readonly LlmToolDefinition[] = [
    {
        name: TITLE_SUGGESTION_TOOL.getTaskEvents,
        description: GET_TASK_EVENTS_DESCRIPTION,
        shape: getTaskEventsShape,
    },
];

export const TITLE_SUGGESTION_TOOL_NAMES: readonly string[] = TITLE_SUGGESTION_TOOLS.map(
    (spec) => spec.name,
);

export type GetTaskEventsArgs = z.infer<z.ZodObject<typeof getTaskEventsShape>>;

export function parseGetTaskEventsArgs(raw: unknown): GetTaskEventsArgs {
    return z.object(getTaskEventsShape).parse(raw);
}

/** 도구가 무너졌을 때 모델이 읽는 문구이며 값은 계약이 소유한다. */
export const TITLE_SUGGESTION_FAILURES: ToolFailureTexts = {
    toolFailed:
        "Tool {tool} failed: {reason}. Do not call it again more than once. "
        + "Continue with the evidence you already have, and state in your rationale "
        + "which evidence you could not check.",
};
