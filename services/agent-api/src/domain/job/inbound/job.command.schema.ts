import { z } from "zod";
import {
    JOB_KIND,
    TASK_CLEANUP_MAX_SUGGESTIONS,
    type JobKind,
} from "~agent-api/domain/job/model/job.const.js";

// 잡 입력이 워크플로 인자로 그대로 흘러가므로 종류마다 허용 필드를 고정한다.

const taskIdSchema = z.string().trim().min(1).max(64);

export const titleSuggestionJobInputSchema = z.object({
    taskId: taskIdSchema,
}).strict();

export const recipeScanJobInputSchema = z.object({
    taskId: taskIdSchema,
    userPrompt: z.string().trim().min(1).max(4000).optional(),
    language: z.string().trim().min(1).max(16).optional(),
    trigger: z.enum(["dashboard", "session"]).optional(),
}).strict();

export const taskCleanupJobInputSchema = z.object({
    filters: z.object({
        maxSuggestions: z.number().int().positive().max(TASK_CLEANUP_MAX_SUGGESTIONS).optional(),
    }).strict().optional(),
}).strict();

export const JOB_INPUT_SCHEMA_BY_KIND = {
    [JOB_KIND.titleSuggestion]: titleSuggestionJobInputSchema,
    [JOB_KIND.recipeScan]: recipeScanJobInputSchema,
    [JOB_KIND.taskCleanup]: taskCleanupJobInputSchema,
} as const satisfies Record<JobKind, z.ZodTypeAny>;

function enqueueBodyFor<K extends JobKind>(kind: K, inputRequired = false) {
    const inputSchema = JOB_INPUT_SCHEMA_BY_KIND[kind];
    return z.object({
        kind: z.literal(kind),
        input: inputRequired ? inputSchema : inputSchema.optional(),
        idempotencyKey: z.string().trim().min(1).max(200).optional(),
    });
}

export const enqueueBodySchema = z.discriminatedUnion("kind", [
    enqueueBodyFor(JOB_KIND.titleSuggestion),
    enqueueBodyFor(JOB_KIND.recipeScan),
    enqueueBodyFor(JOB_KIND.taskCleanup),
]);

export type EnqueueBody = z.infer<typeof enqueueBodySchema>;
