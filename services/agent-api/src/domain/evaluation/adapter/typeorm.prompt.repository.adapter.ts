import { Inject, Injectable } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import type {
    PromptFragmentDefinition, PromptFragmentManifestEntry, PromptFragmentVersion, ResolvedPromptFragment,
} from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import {
    newFragmentBinding, newFragmentChannel, newFragmentDefinition, newFragmentVersion, promptFragmentChannel,
    resolveFragment, SEEDED_FRAGMENT_CHANNEL,
} from "~agent-api/domain/evaluation/model/prompt.fragment.policy.js";
import type { PromptBackend, PromptChannel, PromptChannelAssignment, PromptDefinition, PromptPromotion, PromptVersion } from "~agent-api/domain/evaluation/model/prompt.model.js";
import type { PromptFragmentCatalogItem, PromptRepositoryPort } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import { PROMPT_CLOCK, PROMPT_ID_GENERATOR, type PromptClockPort, type PromptIdGeneratorPort } from "~agent-api/domain/evaluation/port/prompt.runtime.port.js";
import {
    PromptChannelEntity, PromptDefinitionEntity, PromptPromotionEntity, PromptVersionEntity,
    toPromptChannel, toPromptChannelRow, toPromptDefinition, toPromptDefinitionRow,
    toPromptPromotionRow, toPromptVersion, toPromptVersionRow,
} from "./prompt.entity.js";
import {
    PromptFragmentBindingEntity, PromptFragmentChannelEntity, PromptFragmentDefinitionEntity,
    PromptFragmentVersionEntity, toPromptFragmentBinding, toPromptFragmentBindingRow, toPromptFragmentChannelRow,
    toPromptFragmentDefinition, toPromptFragmentDefinitionRow, toPromptFragmentVersion,
    toPromptFragmentVersionRow,
} from "./prompt.fragment.entity.js";

@Injectable()
export class TypeOrmPromptRepositoryAdapter implements PromptRepositoryPort {
    constructor(@Inject(AGENT_DATA_SOURCE) private readonly source: DataSource,
        @Inject(PROMPT_ID_GENERATOR) private readonly ids: PromptIdGeneratorPort,
        @Inject(PROMPT_CLOCK) private readonly clock: PromptClockPort) {}
    async savePrompt(definition: PromptDefinition, version: PromptVersion): Promise<void> {
        await this.source.transaction(async (manager) => {
            await manager.getRepository(PromptDefinitionEntity).insert(toPromptDefinitionRow(definition));
            await manager.getRepository(PromptVersionEntity).insert(toPromptVersionRow(version));
        });
    }
    async savePromptDefinition(definition: PromptDefinition): Promise<void> {
        await this.source.getRepository(PromptDefinitionEntity).insert(toPromptDefinitionRow(definition));
    }
    async savePromptVersion(userId: string, version: PromptVersion): Promise<void> {
        await this.requireDefinition(userId, version.definitionId);
        await this.source.getRepository(PromptVersionEntity).insert(toPromptVersionRow(version));
    }
    async findPromptDefinition(userId: string, id: string): Promise<PromptDefinition | null> {
        const row = await this.source.getRepository(PromptDefinitionEntity).findOne({ where: { id, userId } });
        return row ? toPromptDefinition(row) : null;
    }
    async findPromptVersion(userId: string, id: string): Promise<PromptVersion | null> {
        const row = await this.source.getRepository(PromptVersionEntity).createQueryBuilder("version")
            .innerJoin(PromptDefinitionEntity, "definition", "definition.id = version.definition_id")
            .where("version.id = :id", { id }).andWhere("definition.user_id = :userId", { userId }).getOne();
        return row ? toPromptVersion(row) : null;
    }
    async listPromptDefinitions(userId: string): Promise<readonly PromptDefinition[]> {
        return (await this.source.getRepository(PromptDefinitionEntity).find({ where: { userId }, order: { createdAt: "DESC" } }))
            .map(toPromptDefinition);
    }
    async listPromptVersions(userId: string, definitionId: string): Promise<readonly PromptVersion[]> {
        await this.requireDefinition(userId, definitionId);
        return (await this.source.getRepository(PromptVersionEntity).find({ where: { definitionId }, order: { createdAt: "DESC" } }))
            .map(toPromptVersion);
    }
    async findPromptChannel(userId: string, definitionId: string, channel: PromptChannelAssignment["channel"]) {
        if (!await this.findPromptDefinition(userId, definitionId)) return null;
        const row = await this.source.getRepository(PromptChannelEntity).findOne({ where: { definitionId, channel } });
        return row ? toPromptChannel(row) : null;
    }
    async listPromptChannels(userId: string, definitionId: string) {
        await this.requireDefinition(userId, definitionId);
        return (await this.source.getRepository(PromptChannelEntity).find({ where: { definitionId } })).map(toPromptChannel);
    }
    async savePromptChannel(userId: string, channel: PromptChannelAssignment, promotion: PromptPromotion): Promise<void> {
        await this.requireDefinition(userId, channel.definitionId);
        await this.source.transaction(async (manager) => this.writeChannel(manager, channel, promotion));
    }
    async registerPythonPrompt(_userId: string, definition: PromptDefinition, version: PromptVersion, channel: PromptChannelAssignment): Promise<void> {
        await this.source.transaction(async (manager) => {
            await manager.getRepository(PromptDefinitionEntity).insert(toPromptDefinitionRow(definition));
            await manager.getRepository(PromptVersionEntity).insert(toPromptVersionRow(version));
            await manager.getRepository(PromptChannelEntity).insert(toPromptChannelRow(channel));
        });
    }
    async registerAndResolveFragments(profile: string, manifest: readonly PromptFragmentManifestEntry[]): Promise<readonly ResolvedPromptFragment[]> {
        const channel = promptFragmentChannel(profile);
        return this.source.transaction(async (manager) => {
            const resolved: ResolvedPromptFragment[] = [];
            for (const entry of manifest) resolved.push(...await this.registerManifestEntry(manager, entry, channel));
            return resolved;
        });
    }
    async listFragmentCatalog(filter: { agentName?: string | undefined; backend?: PromptBackend | undefined }): Promise<readonly PromptFragmentCatalogItem[]> {
        const definitions = await this.source.getRepository(PromptFragmentDefinitionEntity).find({
            where: { ...(filter.agentName ? { agentName: filter.agentName } : {}), ...(filter.backend ? { backend: filter.backend } : {}) },
        });
        const result: PromptFragmentCatalogItem[] = [];
        for (const row of definitions) {
            const binding = await this.source.getRepository(PromptFragmentBindingEntity).findOne({ where: { definitionId: row.id } });
            if (!binding) continue;
            const versions = await this.source.getRepository(PromptFragmentVersionEntity).find({ where: { definitionId: row.id } });
            result.push({ definition: toPromptFragmentDefinition(row), binding: toPromptFragmentBinding(binding), versions: versions.map(toPromptFragmentVersion) });
        }
        return result;
    }
    async findFragmentDefinition(scope: Parameters<PromptRepositoryPort["findFragmentDefinition"]>[0]): Promise<PromptFragmentDefinition | null> {
        const row = await this.source.getRepository(PromptFragmentDefinitionEntity).findOne({ where: { ...scope } });
        return row ? toPromptFragmentDefinition(row) : null;
    }
    async listFragmentVersions(definitionId: string): Promise<readonly PromptFragmentVersion[]> {
        return (await this.source.getRepository(PromptFragmentVersionEntity).find({ where: { definitionId }, order: { createdAt: "ASC" } }))
            .map(toPromptFragmentVersion);
    }
    async saveCandidateFragmentVersion(input: Parameters<PromptRepositoryPort["saveCandidateFragmentVersion"]>[0]): Promise<void> {
        await this.source.transaction(async (manager) => {
            await manager.getRepository(PromptFragmentVersionEntity).insert(toPromptFragmentVersionRow(input.version));
            await manager.getRepository(PromptFragmentChannelEntity).upsert(toPromptFragmentChannelRow(input.channel), ["definitionId", "channel"]);
        });
    }
    private async requireDefinition(userId: string, id: string): Promise<void> {
        if (!await this.findPromptDefinition(userId, id)) throw new Error("Prompt definition not found");
    }
    private async writeChannel(manager: EntityManager, channel: PromptChannelAssignment, promotion: PromptPromotion): Promise<void> {
        await manager.getRepository(PromptChannelEntity).upsert(toPromptChannelRow(channel), ["definitionId", "channel"]);
        await manager.getRepository(PromptPromotionEntity).save(toPromptPromotionRow(promotion));
    }
    private async registerManifestEntry(manager: EntityManager, entry: PromptFragmentManifestEntry,
        channel: PromptChannel): Promise<readonly ResolvedPromptFragment[]> {
        const definition = await this.ensureFragmentDefinition(manager, entry);
        const seed = await this.ensureFragmentVersion(manager, entry, definition.id);
        await this.ensureFragmentBindings(manager, entry, definition.id);
        await this.ensureFragmentChannel(manager, definition.id, seed.id);
        const selected = await this.selectFragmentVersion(manager, definition.id, channel);
        return selected === null ? [] : entry.bindings.map((binding) => resolveFragment(binding, definition, selected));
    }
    private async ensureFragmentDefinition(manager: EntityManager, entry: PromptFragmentManifestEntry): Promise<PromptFragmentDefinition> {
        const repository = manager.getRepository(PromptFragmentDefinitionEntity);
        const found = await repository.findOne({ where: { definitionKey: entry.definitionKey } });
        if (found) return toPromptFragmentDefinition(found);
        const created = newFragmentDefinition(entry, this.ids.next("fragment"), this.clock.now());
        await repository.insert(toPromptFragmentDefinitionRow(created));
        return created;
    }
    private async ensureFragmentVersion(manager: EntityManager, entry: PromptFragmentManifestEntry,
        definitionId: string): Promise<PromptFragmentVersion> {
        const repository = manager.getRepository(PromptFragmentVersionEntity);
        const found = await repository.findOne({ where: { definitionId, semanticVersion: entry.defaultVersion } });
        if (found) return toPromptFragmentVersion(found);
        const created = newFragmentVersion(entry, this.ids.next("fragment-version"), definitionId, this.clock.now());
        await repository.insert(toPromptFragmentVersionRow(created));
        return created;
    }
    private async ensureFragmentBindings(manager: EntityManager, entry: PromptFragmentManifestEntry, definitionId: string): Promise<void> {
        const repository = manager.getRepository(PromptFragmentBindingEntity);
        for (const binding of entry.bindings) {
            const found = await repository.findOne({ where: { templateKey: binding.templateKey, fragmentSlot: binding.fragmentSlot } });
            if (found) continue;
            await repository.insert(toPromptFragmentBindingRow(
                newFragmentBinding(entry, binding, this.ids.next("fragment-binding"), definitionId, this.clock.now()),
            ));
        }
    }
    private async ensureFragmentChannel(manager: EntityManager, definitionId: string, versionId: string): Promise<void> {
        const repository = manager.getRepository(PromptFragmentChannelEntity);
        if (await repository.findOne({ where: { definitionId } })) return;
        await repository.insert(toPromptFragmentChannelRow(
            newFragmentChannel(this.ids.next("fragment-channel"), definitionId, SEEDED_FRAGMENT_CHANNEL, versionId, this.clock.now()),
        ));
    }
    private async selectFragmentVersion(manager: EntityManager, definitionId: string,
        channel: PromptChannel): Promise<PromptFragmentVersion | null> {
        const assignment = await manager.getRepository(PromptFragmentChannelEntity)
            .findOne({ where: { definitionId, channel } });
        if (!assignment) return null;
        const version = await manager.getRepository(PromptFragmentVersionEntity).findOne({ where: { id: assignment.versionId } });
        return version ? toPromptFragmentVersion(version) : null;
    }
}
