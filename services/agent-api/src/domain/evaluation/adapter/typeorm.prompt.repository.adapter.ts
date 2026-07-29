import { Inject, Injectable } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import type { PromptFragmentManifestEntry, ResolvedPromptFragment } from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import type { PromptBackend, PromptChannelAssignment, PromptDefinition, PromptPromotion, PromptVersion } from "~agent-api/domain/evaluation/model/prompt.model.js";
import type { PromptFragmentCatalogItem, PromptRepositoryPort } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import {
    PromptChannelEntity, PromptDefinitionEntity, PromptPromotionEntity, PromptVersionEntity,
    toPromptChannel, toPromptChannelRow, toPromptDefinition, toPromptDefinitionRow,
    toPromptPromotionRow, toPromptVersion, toPromptVersionRow,
} from "./prompt.entity.js";
import {
    PromptFragmentBindingEntity, PromptFragmentChannelEntity, PromptFragmentDefinitionEntity,
    PromptFragmentVersionEntity, toPromptFragmentBinding, toPromptFragmentChannelRow,
    toPromptFragmentDefinition, toPromptFragmentDefinitionRow, toPromptFragmentVersion,
    toPromptFragmentVersionRow,
} from "./prompt.fragment.entity.js";

@Injectable()
export class TypeOrmPromptRepositoryAdapter implements PromptRepositoryPort {
    constructor(@Inject(AGENT_DATA_SOURCE) private readonly source: DataSource) {}
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
    async registerAndResolveFragments(_profile: string, manifest: readonly PromptFragmentManifestEntry[]): Promise<readonly ResolvedPromptFragment[]> {
        return this.source.transaction(async (manager) => {
            const resolved: ResolvedPromptFragment[] = [];
            for (const entry of manifest) resolved.push(await this.resolveManifestEntry(manager, entry));
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
    async saveCandidateFragment(input: Parameters<PromptRepositoryPort["saveCandidateFragment"]>[0]): Promise<void> {
        await this.source.transaction(async (manager) => {
            await manager.getRepository(PromptFragmentDefinitionEntity).upsert(toPromptFragmentDefinitionRow(input.definition), ["id"]);
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
    private async resolveManifestEntry(manager: EntityManager, entry: PromptFragmentManifestEntry): Promise<ResolvedPromptFragment> {
        const definition = await manager.getRepository(PromptFragmentDefinitionEntity).findOne({
            where: { definitionKey: `${entry.backend}.${entry.agentName}.${entry.fragmentName}` },
        });
        if (!definition) throw new Error("Prompt fragment definition is not registered");
        const version = await manager.getRepository(PromptFragmentVersionEntity).findOne({
            where: { definitionId: definition.id, semanticVersion: entry.semanticVersion },
        });
        if (!version) throw new Error("Prompt fragment version is not registered");
        return { templateKey: entry.templateKey, fragmentSlot: entry.fragmentSlot, definitionId: definition.id,
            versionId: version.id, content: version.content, contentHash: version.contentHash };
    }
}
