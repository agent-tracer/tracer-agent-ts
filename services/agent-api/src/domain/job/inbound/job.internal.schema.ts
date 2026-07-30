import { z } from "zod";
import { WORKFLOW_JOB_KINDS } from "~agent-api/domain/job/model/job.const.js";

export const jobEnvelopeKindSchema = z.enum(WORKFLOW_JOB_KINDS);

export const jobEnvelopeBodySchema = z.object({
    userId: z.string().trim().min(1),
}).strict();

export type JobEnvelopeKind = z.infer<typeof jobEnvelopeKindSchema>;
export type JobEnvelopeBody = z.infer<typeof jobEnvelopeBodySchema>;
