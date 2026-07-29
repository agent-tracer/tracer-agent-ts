import { Column, Entity, PrimaryColumn } from "typeorm";
import {
    PromptChannelAssignment, PromptDefinition, PromptPromotion, PromptVersion,
    type PromptBackend, type PromptChannel,
} from "~agent-api/domain/evaluation/model/prompt.model.js";

@Entity({ name: "prompt_definitions" })
export class PromptDefinitionEntity {
    @PrimaryColumn({ type: "text" }) id!: string;
    @Column({ name: "user_id", type: "text" }) userId!: string;
    @Column({ name: "agent_name", type: "text" }) agentName!: string;
    @Column({ type: "text" }) backend!: PromptBackend;
    @Column({ type: "text" }) language!: string;
    @Column({ type: "text" }) name!: string;
    @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}

@Entity({ name: "prompt_versions" })
export class PromptVersionEntity {
    @PrimaryColumn({ type: "text" }) id!: string;
    @Column({ name: "definition_id", type: "text" }) definitionId!: string;
    @Column({ name: "semantic_version", type: "text" }) semanticVersion!: string;
    @Column({ type: "text" }) content!: string;
    @Column({ name: "content_hash", type: "text" }) contentHash!: string;
    @Column({ name: "tool_contract_version", type: "text" }) toolContractVersion!: string;
    @Column({ name: "output_schema_version", type: "text" }) outputSchemaVersion!: string;
    @Column({ name: "content_origin", type: "text" }) contentOrigin!: "file" | "user-authored";
    @Column({ name: "created_by", type: "text" }) createdBy!: string;
    @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}

@Entity({ name: "prompt_channels" })
export class PromptChannelEntity {
    @PrimaryColumn({ type: "text" }) id!: string;
    @Column({ name: "definition_id", type: "text" }) definitionId!: string;
    @Column({ type: "text" }) channel!: PromptChannel;
    @Column({ name: "version_id", type: "text" }) versionId!: string;
    @Column({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}

@Entity({ name: "prompt_promotions" })
export class PromptPromotionEntity {
    @PrimaryColumn({ type: "text" }) id!: string;
    @Column({ name: "user_id", type: "text" }) userId!: string;
    @Column({ name: "prompt_version_id", type: "text" }) promptVersionId!: string;
    @Column({ name: "experiment_id", type: "text", nullable: true }) experimentId!: string | null;
    @Column({ name: "from_channel", type: "text", nullable: true }) fromChannel!: PromptChannel | null;
    @Column({ name: "to_channel", type: "text" }) toChannel!: PromptChannel;
    @Column({ name: "gate_result", type: "jsonb" }) gateResult!: Record<string, unknown>;
    @Column({ name: "promoted_by", type: "text" }) promotedBy!: string;
    @Column({ name: "promoted_at", type: "timestamptz" }) promotedAt!: Date;
}

function copy<T extends object>(target: T, source: T): T { return Object.assign(target, source); }
export const toPromptDefinition = (row: PromptDefinitionEntity): PromptDefinition => copy(new PromptDefinition(), row);
export const toPromptDefinitionRow = (model: PromptDefinition): PromptDefinitionEntity => copy(new PromptDefinitionEntity(), model);
export const toPromptVersion = (row: PromptVersionEntity): PromptVersion => copy(new PromptVersion(), row);
export const toPromptVersionRow = (model: PromptVersion): PromptVersionEntity => copy(new PromptVersionEntity(), model);
export const toPromptChannel = (row: PromptChannelEntity): PromptChannelAssignment => copy(new PromptChannelAssignment(), row);
export const toPromptChannelRow = (model: PromptChannelAssignment): PromptChannelEntity => copy(new PromptChannelEntity(), model);
export const toPromptPromotion = (row: PromptPromotionEntity): PromptPromotion => copy(new PromptPromotion(), row);
export const toPromptPromotionRow = (model: PromptPromotion): PromptPromotionEntity => copy(new PromptPromotionEntity(), model);
