import type {
    PromptFragmentBinding, PromptFragmentChannelAssignment, PromptFragmentDefinition, PromptFragmentManifestEntry,
    PromptFragmentVersion, ResolvedPromptFragment,
} from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import type {
    PromptBackend, PromptChannel, PromptChannelAssignment, PromptDefinition, PromptPromotion, PromptVersion,
} from "~agent-api/domain/evaluation/model/prompt.model.js";

export interface PromptFragmentCatalogItem {
    readonly definition: PromptFragmentDefinition;
    readonly binding: PromptFragmentBinding;
    readonly versions: readonly PromptFragmentVersion[];
}

export const PROMPT_REPOSITORY = Symbol("PROMPT_REPOSITORY");
export interface PromptRepositoryPort {
    savePrompt(definition: PromptDefinition, version: PromptVersion): Promise<void>;
    savePromptDefinition(definition: PromptDefinition): Promise<void>;
    savePromptVersion(userId: string, version: PromptVersion): Promise<void>;
    findPromptDefinition(userId: string, id: string): Promise<PromptDefinition | null>;
    findPromptVersion(userId: string, id: string): Promise<PromptVersion | null>;
    listPromptDefinitions(userId: string): Promise<readonly PromptDefinition[]>;
    listPromptVersions(userId: string, definitionId: string): Promise<readonly PromptVersion[]>;
    findPromptChannel(userId: string, definitionId: string, channel: PromptChannel): Promise<PromptChannelAssignment | null>;
    listPromptChannels(userId: string, definitionId: string): Promise<readonly PromptChannelAssignment[]>;
    savePromptChannel(userId: string, channel: PromptChannelAssignment, promotion: PromptPromotion): Promise<void>;
    registerPythonPrompt(userId: string, definition: PromptDefinition, version: PromptVersion, channel: PromptChannelAssignment): Promise<void>;
    registerAndResolveFragments(profile: string, manifest: readonly PromptFragmentManifestEntry[]): Promise<readonly ResolvedPromptFragment[]>;
    listFragmentCatalog(filter: { agentName?: string | undefined; backend?: PromptBackend | undefined }): Promise<readonly PromptFragmentCatalogItem[]>;
    findFragmentDefinition(scope: {
        backend: PromptBackend; agentName: string; fragmentName: string; language: string;
    }): Promise<PromptFragmentDefinition | null>;
    listFragmentVersions(definitionId: string): Promise<readonly PromptFragmentVersion[]>;
    saveCandidateFragmentVersion(input: {
        version: PromptFragmentVersion; channel: PromptFragmentChannelAssignment;
    }): Promise<void>;
    findFragmentVersion(definitionId: string, versionId: string): Promise<PromptFragmentVersion | null>;
    findFragmentChannel(definitionId: string, channel: PromptChannel): Promise<PromptFragmentChannelAssignment | null>;
    saveFragmentChannel(channel: PromptFragmentChannelAssignment): Promise<void>;
}
