import { z } from "zod";

const version = z.object({
    semanticVersion: z.string().trim().min(1),
    content: z.string().min(1),
    contentHash: z.string().trim().min(1).optional(),
    toolContractVersion: z.string().trim().min(1),
    outputSchemaVersion: z.string().trim().min(1),
}).strict();

export const createPromptSchema = z.object({
    name: z.string().trim().min(1), agentName: z.string().trim().min(1),
    backend: z.enum(["python", "claude-sdk"]), language: z.string().trim().min(1), version,
}).strict();
export const createPromptVersionSchema = version;
export const promotePromptSchema = z.object({
    versionId: z.string().trim().min(1), channel: z.enum(["candidate", "staging", "production"]),
    experimentId: z.string().trim().min(1),
}).strict();
export const rollbackPromptChannelSchema = z.object({
    versionId: z.string().trim().min(1), channel: z.enum(["candidate", "staging", "production"]),
}).strict();
export const registerPythonPromptSchema = z.object({
    name: z.string().trim().min(1), agentName: z.string().trim().min(1),
    language: z.string().trim().min(1), version,
}).strict();
export const promptFragmentCatalogQuerySchema = z.object({
    agentName: z.string().trim().min(1).optional(), backend: z.enum(["python", "claude-sdk"]).optional(),
});
export const registerCandidateFragmentVersionSchema = z.object({
    backend: z.enum(["python", "claude-sdk"]), agentName: z.string().trim().min(1),
    fragmentName: z.string().trim().min(1), language: z.string().trim().min(1),
    content: z.string().min(1), changeSummary: z.string().trim().min(1).nullable().default(null),
}).strict();

export type CreatePromptPayload = z.infer<typeof createPromptSchema>;
export type CreatePromptVersionPayload = z.infer<typeof createPromptVersionSchema>;
export type PromotePromptPayload = z.infer<typeof promotePromptSchema>;
export type RollbackPromptChannelPayload = z.infer<typeof rollbackPromptChannelSchema>;
export type RegisterPythonPromptPayload = z.infer<typeof registerPythonPromptSchema>;
export type PromptFragmentCatalogQuery = z.infer<typeof promptFragmentCatalogQuerySchema>;
export type RegisterCandidateFragmentVersionPayload = z.infer<typeof registerCandidateFragmentVersionSchema>;
