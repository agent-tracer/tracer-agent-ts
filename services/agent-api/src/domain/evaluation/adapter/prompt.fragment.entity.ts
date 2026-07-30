import { Column, Entity, PrimaryColumn } from "typeorm";
import {
    PromptFragmentBinding, PromptFragmentChannelAssignment, PromptFragmentDefinition, PromptFragmentVersion,
    type PromptFragmentOrigin,
} from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import type { PromptBackend, PromptChannel } from "~agent-api/domain/evaluation/model/prompt.model.js";

@Entity({ name: "prompt_fragment_definitions" })
export class PromptFragmentDefinitionEntity {
    @PrimaryColumn({ type: "text" }) id!: string;
    @Column({ name: "definition_key", type: "text" }) definitionKey!: string;
    @Column({ name: "agent_name", type: "text" }) agentName!: string;
    @Column({ type: "text" }) backend!: PromptBackend;
    @Column({ type: "text" }) language!: string;
    @Column({ name: "fragment_name", type: "text" }) fragmentName!: string;
    @Column({ name: "code_name", type: "text" }) codeName!: string;
    @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}

@Entity({ name: "prompt_fragment_versions" })
export class PromptFragmentVersionEntity {
    @PrimaryColumn({ type: "text" }) id!: string;
    @Column({ name: "definition_id", type: "text" }) definitionId!: string;
    @Column({ name: "semantic_version", type: "text" }) semanticVersion!: string;
    @Column({ type: "text" }) content!: string;
    @Column({ name: "content_hash", type: "text" }) contentHash!: string;
    @Column({ type: "jsonb" }) placeholders!: readonly string[];
    @Column({ name: "tool_contract_version", type: "text" }) toolContractVersion!: string;
    @Column({ name: "output_schema_version", type: "text" }) outputSchemaVersion!: string;
    @Column({ type: "text" }) origin!: PromptFragmentOrigin;
    @Column({ name: "previous_version_id", type: "text", nullable: true }) previousVersionId!: string | null;
    @Column({ name: "change_summary", type: "text", nullable: true }) changeSummary!: string | null;
    @Column({ name: "created_by", type: "text" }) createdBy!: string;
    @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}

@Entity({ name: "prompt_fragment_bindings" })
export class PromptFragmentBindingEntity {
    @PrimaryColumn({ type: "text" }) id!: string;
    @Column({ type: "text" }) backend!: PromptBackend;
    @Column({ name: "template_key", type: "text" }) templateKey!: string;
    @Column({ name: "fragment_slot", type: "text" }) fragmentSlot!: string;
    @Column({ name: "definition_id", type: "text" }) definitionId!: string;
    @Column({ name: "code_default_version", type: "text" }) codeDefaultVersion!: string;
    @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
    @Column({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}

@Entity({ name: "prompt_fragment_channels" })
export class PromptFragmentChannelEntity {
    @PrimaryColumn({ type: "text" }) id!: string;
    @Column({ name: "definition_id", type: "text" }) definitionId!: string;
    @Column({ type: "text" }) channel!: PromptChannel;
    @Column({ name: "version_id", type: "text" }) versionId!: string;
    @Column({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}

function copy<T extends object>(target: T, source: T): T { return Object.assign(target, source); }
export const toPromptFragmentDefinition = (row: PromptFragmentDefinitionEntity): PromptFragmentDefinition => copy(new PromptFragmentDefinition(), row);
export const toPromptFragmentDefinitionRow = (model: PromptFragmentDefinition): PromptFragmentDefinitionEntity => copy(new PromptFragmentDefinitionEntity(), model);
export const toPromptFragmentVersion = (row: PromptFragmentVersionEntity): PromptFragmentVersion => copy(new PromptFragmentVersion(), row);
export const toPromptFragmentVersionRow = (model: PromptFragmentVersion): PromptFragmentVersionEntity => copy(new PromptFragmentVersionEntity(), model);
export const toPromptFragmentBinding = (row: PromptFragmentBindingEntity): PromptFragmentBinding => copy(new PromptFragmentBinding(), row);
export const toPromptFragmentBindingRow = (model: PromptFragmentBinding): PromptFragmentBindingEntity => copy(new PromptFragmentBindingEntity(), model);
export const toPromptFragmentChannel = (row: PromptFragmentChannelEntity): PromptFragmentChannelAssignment => copy(new PromptFragmentChannelAssignment(), row);
export const toPromptFragmentChannelRow = (model: PromptFragmentChannelAssignment): PromptFragmentChannelEntity => copy(new PromptFragmentChannelEntity(), model);
