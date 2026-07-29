import {
    PromptFragmentDefinition, PromptFragmentVersion,
    type PromptFragmentManifestEntry, type ResolvedPromptFragment, extractFragmentPlaceholders,
} from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import type {
    PromptFragmentBinding, PromptFragmentChannelAssignment,
} from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import { promptContentHash } from "~agent-api/domain/evaluation/model/prompt.hash.js";
import type {
    PromptBackend, PromptChannel, PromptChannelAssignment, PromptDefinition, PromptPromotion, PromptVersion,
} from "~agent-api/domain/evaluation/model/prompt.model.js";
import type { PromptRepositoryPort, PromptFragmentCatalogItem } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import type { PromptClockPort, PromptIdGeneratorPort, PromptPromotionGatePort, PromotionGateResult } from "~agent-api/domain/evaluation/port/prompt.runtime.port.js";

export class FixedPromptClock implements PromptClockPort {
    constructor(private readonly value: Date) {}
    now(): Date { return this.value; }
}
export class SequentialPromptIdGenerator implements PromptIdGeneratorPort {
    private sequence = 0;
    next(prefix: string): string { this.sequence += 1; return `${prefix}-${this.sequence}`; }
}
export class FixedPromptPromotionGate implements PromptPromotionGatePort {
    constructor(private readonly result: PromotionGateResult) {}
    async evaluate(): Promise<PromotionGateResult> { return this.result; }
}

export class InMemoryPromptRepository implements PromptRepositoryPort {
    readonly definitions: PromptDefinition[] = [];
    readonly versions: PromptVersion[] = [];
    readonly channels: PromptChannelAssignment[] = [];
    readonly promotions: PromptPromotion[] = [];
    readonly fragmentDefinitions: PromptFragmentDefinition[] = [];
    readonly fragmentVersions: PromptFragmentVersion[] = [];
    readonly fragmentBindings: PromptFragmentBinding[] = [];
    readonly fragmentChannels: PromptFragmentChannelAssignment[] = [];

    async savePrompt(definition: PromptDefinition, version: PromptVersion): Promise<void> {
        this.definitions.push(definition); this.versions.push(version);
    }
    async savePromptDefinition(definition: PromptDefinition): Promise<void> { this.definitions.push(definition); }
    async savePromptVersion(userId: string, version: PromptVersion): Promise<void> {
        if (!await this.findPromptDefinition(userId, version.definitionId)) throw new Error("Prompt definition not found");
        this.versions.push(version);
    }
    async findPromptDefinition(userId: string, id: string): Promise<PromptDefinition | null> {
        return this.definitions.find((item) => item.userId === userId && item.id === id) ?? null;
    }
    async findPromptVersion(userId: string, id: string): Promise<PromptVersion | null> {
        const version = this.versions.find((item) => item.id === id);
        return version && await this.findPromptDefinition(userId, version.definitionId) ? version : null;
    }
    async listPromptDefinitions(userId: string): Promise<readonly PromptDefinition[]> {
        return this.definitions.filter((item) => item.userId === userId);
    }
    async listPromptVersions(userId: string, definitionId: string): Promise<readonly PromptVersion[]> {
        return await this.findPromptDefinition(userId, definitionId)
            ? this.versions.filter((item) => item.definitionId === definitionId) : [];
    }
    async findPromptChannel(userId: string, definitionId: string, channel: PromptChannel): Promise<PromptChannelAssignment | null> {
        if (!await this.findPromptDefinition(userId, definitionId)) return null;
        return this.channels.find((item) => item.definitionId === definitionId && item.channel === channel) ?? null;
    }
    async listPromptChannels(userId: string, definitionId: string): Promise<readonly PromptChannelAssignment[]> {
        return await this.findPromptDefinition(userId, definitionId)
            ? this.channels.filter((item) => item.definitionId === definitionId) : [];
    }
    async savePromptChannel(userId: string, channel: PromptChannelAssignment, promotion: PromptPromotion): Promise<void> {
        if (!await this.findPromptDefinition(userId, channel.definitionId)) throw new Error("Prompt definition not found");
        const index = this.channels.findIndex((item) => item.id === channel.id);
        if (index < 0) this.channels.push(channel); else this.channels[index] = channel;
        this.promotions.push(promotion);
    }
    async registerPythonPrompt(_userId: string, definition: PromptDefinition, version: PromptVersion, channel: PromptChannelAssignment): Promise<void> {
        await this.savePrompt(definition, version); this.channels.push(channel);
    }
    async registerAndResolveFragments(_profile: string, manifest: readonly PromptFragmentManifestEntry[]): Promise<readonly ResolvedPromptFragment[]> {
        return manifest.map((entry, index) => this.registerManifestEntry(entry, index));
    }
    async listFragmentCatalog(filter: { agentName?: string | undefined; backend?: PromptBackend | undefined }): Promise<readonly PromptFragmentCatalogItem[]> {
        return this.fragmentBindings.flatMap((binding) => {
            const definition = this.fragmentDefinitions.find((item) => item.id === binding.definitionId);
            if (!definition || filter.agentName && definition.agentName !== filter.agentName || filter.backend && definition.backend !== filter.backend) return [];
            return [{ definition, binding, versions: this.fragmentVersions.filter((item) => item.definitionId === definition.id) }];
        });
    }
    async saveCandidateFragment(input: { definition: PromptFragmentDefinition; version: PromptFragmentVersion; channel: PromptFragmentChannelAssignment }): Promise<void> {
        if (!this.fragmentDefinitions.some((item) => item.id === input.definition.id)) this.fragmentDefinitions.push(input.definition);
        this.fragmentVersions.push(input.version);
        const index = this.fragmentChannels.findIndex((item) => item.definitionId === input.definition.id && item.channel === "candidate");
        if (index < 0) this.fragmentChannels.push(input.channel); else this.fragmentChannels[index] = input.channel;
    }
    private registerManifestEntry(entry: PromptFragmentManifestEntry, index: number): ResolvedPromptFragment {
        const definition = Object.assign(new PromptFragmentDefinition(), {
            id: `fragment-${index}`, definitionKey: `${entry.backend}.${entry.agentName}.${entry.fragmentName}`,
            agentName: entry.agentName, backend: entry.backend, language: entry.language,
            fragmentName: entry.fragmentName, codeName: entry.codeName, createdAt: new Date(0),
        });
        const hash = promptContentHash(entry.content);
        const version = Object.assign(new PromptFragmentVersion(), {
            id: `fragment-version-${index}`, definitionId: definition.id, semanticVersion: entry.semanticVersion,
            content: entry.content, contentHash: hash, placeholders: extractFragmentPlaceholders(entry.content),
            toolContractVersion: entry.toolContractVersion, outputSchemaVersion: entry.outputSchemaVersion,
            origin: "code-default", previousVersionId: null, changeSummary: null, createdBy: "system", createdAt: new Date(0),
        });
        this.fragmentDefinitions.push(definition); this.fragmentVersions.push(version);
        return { templateKey: entry.templateKey, fragmentSlot: entry.fragmentSlot, definitionId: definition.id, versionId: version.id, content: entry.content, contentHash: hash };
    }
}
