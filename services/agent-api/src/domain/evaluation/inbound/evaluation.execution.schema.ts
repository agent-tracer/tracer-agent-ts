import { z } from "zod";

const id = z.string().trim().min(1);
const record = z.record(z.unknown());
const attempt = z.number().int().min(1);

export const leaseEvaluationExecutionSchema = z.object({
    experimentId: id,
    executionId: id.optional(),
}).strict();

export const settleEvaluationExecutionSchema = z.object({
    executionId: id,
    attempt,
    amount: z.number().optional(),
    priorCostUsd: z.number().optional(),
    jobId: id,
    output: record.nullable().optional(),
    durationMs: z.number().int().min(0),
    traceId: z.string().nullable().optional(),
    costUsd: z.number(),
    resolvedPromptHash: z.string().nullable().optional(),
    scores: z.array(z.object({
        evaluatorId: id,
        evaluatorVersion: id,
        score: z.number(),
        label: z.string().nullable().optional(),
        reason: z.string().nullable().optional(),
        judgeCostUsd: z.number().optional(),
    }).strict()),
}).strict();

export const releaseEvaluationExecutionSchema = z.object({
    executionId: id,
    attempt,
    terminal: z.boolean(),
    failureReason: z.string().optional(),
}).strict();

export const finalizeEvaluationExperimentSchema = z.object({
    experimentId: id,
    cancelled: z.boolean(),
    failed: z.boolean(),
    budgetExhausted: z.boolean(),
}).strict();

export type LeaseEvaluationExecutionPayload = z.infer<typeof leaseEvaluationExecutionSchema>;
export type SettleEvaluationExecutionPayload = z.infer<typeof settleEvaluationExecutionSchema>;
export type ReleaseEvaluationExecutionPayload = z.infer<typeof releaseEvaluationExecutionSchema>;
export type FinalizeEvaluationExperimentPayload = z.infer<typeof finalizeEvaluationExperimentSchema>;
