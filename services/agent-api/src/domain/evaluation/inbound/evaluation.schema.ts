import { z } from "zod";

const id = z.string().trim().min(1);
const record = z.record(z.unknown());
const disclosureClass = z.enum([
    "synthetic",
    "approved-evaluation",
    "production-masked",
    "external-disabled",
]);
const example = z.object({
    input: record,
    referenceOutput: record.nullable().optional(),
    metadata: record.optional(),
    disclosureClass,
    evidence: record.optional(),
    sourceExecutionId: id.nullable().optional(),
}).strict();

export const createDatasetSchema = z.object({
    name: id,
    description: z.string().optional(),
    examples: z.array(example).min(1),
}).strict();

export const reviseDatasetSchema = z.object({
    examples: z.array(example).min(1),
}).strict();

export const datasetCandidatesQuerySchema = z.object({
    experimentId: id,
    scoreThreshold: z.coerce.number().min(0).max(1).optional(),
}).strict();

export const trainingExportSchema = z.object({
    datasetRevision: z.number().int().positive().optional(),
    experimentId: id,
    disclosureClasses: z.array(disclosureClass).optional(),
    minScore: z.number().min(0).max(1).nullable().optional(),
    excludeDisabled: z.boolean().optional(),
}).strict();

export type CreateDatasetPayload = z.infer<typeof createDatasetSchema>;
export type ReviseDatasetPayload = z.infer<typeof reviseDatasetSchema>;
export type DatasetCandidatesQuery = z.infer<typeof datasetCandidatesQuerySchema>;
export type TrainingExportPayload = z.infer<typeof trainingExportSchema>;
