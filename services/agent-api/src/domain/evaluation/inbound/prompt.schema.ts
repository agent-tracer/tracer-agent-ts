import { z } from "zod";

/** 조각을 올린 에이전트 서비스를 가르는 이름이며 배포의 상류 선언이 후보를 정하므로 문법만 검사한다. */
export const backendNameSchema = z.string().trim().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/);

const version = z.object({
    semanticVersion: z.string().trim().min(1),
    content: z.string().min(1),
    contentHash: z.string().trim().min(1).optional(),
    toolContractVersion: z.string().trim().min(1),
    outputSchemaVersion: z.string().trim().min(1),
}).strict();

export const createPromptSchema = z.object({
    name: z.string().trim().min(1), agentName: z.string().trim().min(1),
    backend: backendNameSchema, language: z.string().trim().min(1), version,
}).strict();
export const createPromptVersionSchema = version;
/** 승격 원장이 근거 실험을 반드시 싣게 하며 채널을 여는 게이트는 승격 경로가 정한다. */
export const promotePromptSchema = z.object({
    versionId: z.string().trim().min(1), channel: z.enum(["candidate", "staging", "production"]),
    experimentId: z.string().trim().min(1),
}).strict();
export const rollbackPromptChannelSchema = z.object({
    versionId: z.string().trim().min(1), channel: z.enum(["candidate", "staging", "production"]),
}).strict();
export const registerBackendPromptSchema = z.object({
    name: z.string().trim().min(1), agentName: z.string().trim().min(1),
    language: z.string().trim().min(1), version,
}).strict();
const fragmentManifestEntry = z.object({
    backend: backendNameSchema, agentName: z.string().trim().min(1),
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
export const promotePromptFragmentSchema = z.object({
    versionId: z.string().trim().min(1), channel: z.enum(["candidate", "staging", "production"]),
}).strict();
export const promptFragmentCatalogQuerySchema = z.object({
    agentName: z.string().trim().min(1).optional(), backend: backendNameSchema.optional(),
});
export const registerCandidateFragmentVersionSchema = z.object({
    backend: backendNameSchema, agentName: z.string().trim().min(1),
    fragmentName: z.string().trim().min(1), language: z.string().trim().min(1),
    content: z.string().min(1), changeSummary: z.string().trim().min(1).nullable().default(null),
}).strict();

export type CreatePromptPayload = z.infer<typeof createPromptSchema>;
export type CreatePromptVersionPayload = z.infer<typeof createPromptVersionSchema>;
export type PromotePromptPayload = z.infer<typeof promotePromptSchema>;
export type RollbackPromptChannelPayload = z.infer<typeof rollbackPromptChannelSchema>;
export type RegisterBackendPromptPayload = z.infer<typeof registerBackendPromptSchema>;
export type RegisterAndResolvePromptFragmentsPayload = z.infer<typeof registerAndResolvePromptFragmentsSchema>;
export type PromptFragmentCatalogQuery = z.infer<typeof promptFragmentCatalogQuerySchema>;
export type PromotePromptFragmentPayload = z.infer<typeof promotePromptFragmentSchema>;
export type RegisterCandidateFragmentVersionPayload = z.infer<typeof registerCandidateFragmentVersionSchema>;
