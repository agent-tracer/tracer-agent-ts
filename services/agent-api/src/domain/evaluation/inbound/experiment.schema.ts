import { z } from "zod";
import { backendNameSchema } from "./prompt.schema.js";

const identifier = z.string().trim().min(1);
const record = z.record(z.unknown());

const variant = z.object({
    name: identifier,
    baseline: z.boolean(),
    backend: backendNameSchema,
    agentName: identifier,
    promptVersionId: identifier.optional(),
    toolContractVersion: identifier,
    limits: record.optional(),
    fragmentSelections: z.record(z.string()).optional(),
}).strict();

export const createExperimentSchema = z.object({
    datasetId: identifier,
    datasetRevision: z.number().int().positive(),
    evaluatorSetVersion: identifier,
    maxBudgetUsd: z.number().positive(),
    repetitions: z.number().int().positive(),
    variants: z.array(variant).min(2),
}).strict();

export const startExperimentSchema = z.object({
    confirmation: z.object({
        executionCount: z.number().int().nonnegative(),
        maxBudgetUsd: z.number().positive(),
        fingerprint: z.string().min(1),
    }).strict(),
}).strict();


export type CreateExperimentPayload = z.infer<typeof createExperimentSchema>;
export type StartExperimentPayload = z.infer<typeof startExperimentSchema>;
