import type {
    PromptFragmentBinding, PromptFragmentChannelAssignment, PromptFragmentDefinition,
    PromptFragmentManifestBinding, PromptFragmentManifestEntry, PromptFragmentVersion, ResolvedPromptFragment,
} from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import {
    newFragmentBinding, newFragmentChannel, newFragmentDefinition, newFragmentVersion, promptFragmentChannel,
    resolveFragment, SEEDED_FRAGMENT_CHANNEL,
} from "~agent-api/domain/evaluation/model/prompt.fragment.policy.js";
import type {
    PromptBackend, PromptChannel, PromptChannelAssignment, PromptDefinition, PromptPromotion, PromptVersion,
} from "~agent-api/domain/evaluation/model/prompt.model.js";
import type { PromptRepositoryPort, PromptFragmentCatalogItem } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import type { PromptClockPort, PromptIdGeneratorPort, PromptPromotionGatePort, PromotionGateResult } from "~agent-api/domain/evaluation/port/prompt.runtime.port.js";

const FRAGMENT_EPOCH = new Date(0);

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
    private readonly fragmentIds = new SequentialPromptIdGenerator();

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
    async registerAndResolveFragments(profile: string, manifest: readonly PromptFragmentManifestEntry[]): Promise<readonly ResolvedPromptFragment[]> {
        const channel = promptFragmentChannel(profile);
        return manifest.flatMap((entry) => this.registerManifestEntry(entry, channel));
    }
    async listFragmentCatalog(filter: { agentName?: string | undefined; backend?: PromptBackend | undefined }): Promise<readonly PromptFragmentCatalogItem[]> {
        return this.fragmentBindings.flatMap((binding) => {
            const definition = this.fragmentDefinitions.find((item) => item.id === binding.definitionId);
            if (!definition || filter.agentName && definition.agentName !== filter.agentName || filter.backend && definition.backend !== filter.backend) return [];
            return [{ definition, binding, versions: this.fragmentVersions.filter((item) => item.definitionId === definition.id) }];
        });
    }
    async findFragmentDefinition(scope: { backend: PromptBackend; agentName: string; fragmentName: string; language: string }): Promise<PromptFragmentDefinition | null> {
        return this.fragmentDefinitions.find((item) => item.backend === scope.backend && item.agentName === scope.agentName
            && item.fragmentName === scope.fragmentName && item.language === scope.language) ?? null;
    }
    async listFragmentVersions(definitionId: string): Promise<readonly PromptFragmentVersion[]> {
        return this.fragmentVersions.filter((item) => item.definitionId === definitionId);
    }
    async saveCandidateFragmentVersion(input: { version: PromptFragmentVersion; channel: PromptFragmentChannelAssignment }): Promise<void> {
        if (this.fragmentVersions.some((item) => item.definitionId === input.version.definitionId
            && item.semanticVersion === input.version.semanticVersion)) throw new Error("prompt_fragment_versions_scope");
        this.fragmentVersions.push(input.version);
        const index = this.fragmentChannels.findIndex((item) => item.definitionId === input.channel.definitionId && item.channel === input.channel.channel);
        if (index < 0) this.fragmentChannels.push(input.channel); else this.fragmentChannels[index] = input.channel;
    }
    private registerManifestEntry(entry: PromptFragmentManifestEntry, channel: PromptChannel): readonly ResolvedPromptFragment[] {
        const definition = this.ensureFragmentDefinition(entry);
        const seed = this.ensureFragmentVersion(entry, definition.id);
        for (const binding of entry.bindings) this.ensureFragmentBinding(entry, binding, definition.id);
        this.ensureFragmentChannel(definition.id, seed.id);
        const selected = this.selectFragmentVersion(definition.id, channel);
        return selected === null ? [] : entry.bindings.map((binding) => resolveFragment(binding, definition, selected));
    }
    private ensureFragmentDefinition(entry: PromptFragmentManifestEntry): PromptFragmentDefinition {
        const found = this.fragmentDefinitions.find((item) => item.definitionKey === entry.definitionKey);
        if (found) return found;
        const created = newFragmentDefinition(entry, this.fragmentIds.next("declared-fragment"), FRAGMENT_EPOCH);
        this.fragmentDefinitions.push(created);
        return created;
    }
    private ensureFragmentVersion(entry: PromptFragmentManifestEntry, definitionId: string): PromptFragmentVersion {
        const found = this.fragmentVersions.find(
            (item) => item.definitionId === definitionId && item.semanticVersion === entry.defaultVersion,
        );
        if (found) return found;
        const created = newFragmentVersion(entry, this.fragmentIds.next("declared-fragment-version"), definitionId, FRAGMENT_EPOCH);
        this.fragmentVersions.push(created);
        return created;
    }
    private ensureFragmentBinding(entry: PromptFragmentManifestEntry, binding: PromptFragmentManifestBinding, definitionId: string): void {
        if (this.fragmentBindings.some((item) => item.templateKey === binding.templateKey && item.fragmentSlot === binding.fragmentSlot)) return;
        this.fragmentBindings.push(newFragmentBinding(entry, binding, this.fragmentIds.next("declared-fragment-binding"), definitionId, FRAGMENT_EPOCH));
    }
    private ensureFragmentChannel(definitionId: string, versionId: string): void {
        if (this.fragmentChannels.some((item) => item.definitionId === definitionId)) return;
        this.fragmentChannels.push(newFragmentChannel(this.fragmentIds.next("declared-fragment-channel"), definitionId, SEEDED_FRAGMENT_CHANNEL, versionId, FRAGMENT_EPOCH));
    }
    private selectFragmentVersion(definitionId: string, channel: PromptChannel): PromptFragmentVersion | null {
        const assignment = this.fragmentChannels.find(
            (item) => item.definitionId === definitionId && item.channel === channel,
        );
        if (!assignment) return null;
        return this.fragmentVersions.find((item) => item.id === assignment.versionId) ?? null;
    }
}
