import { z } from "zod";
import { JOB_KIND, JOB_STATUS } from "~agent-api/domain/job/model/job.const.js";

const jobKindSchema = z.enum([
    JOB_KIND.titleSuggestion,
    JOB_KIND.recipeScan,
    JOB_KIND.taskCleanup,
    JOB_KIND.ruleGeneration,
]);

export const latestQuerySchema = z.object({ kind: jobKindSchema, taskId: z.string().optional() });
export const listQuerySchema = z.object({ kind: jobKindSchema, status: z.enum([JOB_STATUS.pending]).optional() });
export const historyQuerySchema = z.object({
    kind: jobKindSchema.optional(),
    status: z.enum([
        JOB_STATUS.pending,
        JOB_STATUS.running,
        JOB_STATUS.completed,
        JOB_STATUS.failed,
        JOB_STATUS.canceled,
    ]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
});

export type LatestQuery = z.infer<typeof latestQuerySchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
