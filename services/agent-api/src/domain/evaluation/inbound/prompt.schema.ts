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
const fragmentManifestEntry = z.object({
    backend: z.enum(["python", "claude-sdk"]), agentName: z.string().trim().min(1),
    language: z.string().trim().min(1), codeName: z.string().trim().min(1),
    definitionKey: z.string().trim().min(1), fragmentName: z.string().trim().min(1),
    defaultVersion: z.string().trim().min(1), defaultContent: z.string().min(1),
    toolContractVersion: z.string().trim().min(1), outputSchemaVersion: z.string().trim().min(1),
    bindings: z.array(z.object({
        templateKey: z.string().trim().min(1), fragmentSlot: z.string().trim().min(1),
    }).strict()).min(1),
}).strict();
export const registerAndResolvePromptFragmentsSchema = z.object({
    profile: z.string().trim().min(1), manifest: z.array(fragmentManifestEntry),
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
export type RegisterAndResolvePromptFragmentsPayload = z.infer<typeof registerAndResolvePromptFragmentsSchema>;
export type PromptFragmentCatalogQuery = z.infer<typeof promptFragmentCatalogQuerySchema>;
export type RegisterCandidateFragmentVersionPayload = z.infer<typeof registerCandidateFragmentVersionSchema>;
