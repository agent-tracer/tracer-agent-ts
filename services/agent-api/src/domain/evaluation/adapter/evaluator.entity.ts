import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import {
    EvaluatorDefinition,
    EvaluatorSet,
    EvaluatorSetMember,
} from "../model/evaluator.model.js";
import type { EvaluatorKind } from "../model/evaluation.types.js";

/** 평가자 정의의 PostgreSQL 저장 스키마다. */
@Entity({ name: "evaluator_definitions" })
@Index("evaluator_definitions_name_version", ["name", "version"], { unique: true })
export class EvaluatorDefinitionEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;
    @Column({ type: "text" })
    name!: string;
    @Column({ type: "text" })
    kind!: EvaluatorKind;
    @Column({ type: "text" })
    version!: string;
    @Column({ type: "jsonb", default: {} })
    config!: Record<string, unknown>;
    @Column({ name: "implementation_hash", type: "text" })
    implementationHash!: string;
    @Column({ type: "boolean", default: true })
    enabled!: boolean;
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}

/** 평가자 세트의 PostgreSQL 저장 스키마다. */
@Entity({ name: "evaluator_sets" })
@Index("evaluator_sets_version", ["version"], { unique: true })
export class EvaluatorSetEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;
    @Column({ type: "text" })
    version!: string;
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}

/** 평가자 세트 구성원의 PostgreSQL 저장 스키마다. */
@Entity({ name: "evaluator_set_members" })
@Index("evaluator_set_members_definition", ["setId", "evaluatorDefinitionId"], { unique: true })
@Index("evaluator_set_members_ordinal", ["setId", "ordinal"], { unique: true })
export class EvaluatorSetMemberEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;
    @Column({ name: "set_id", type: "text" })
    setId!: string;
    @Column({ name: "evaluator_definition_id", type: "text" })
    evaluatorDefinitionId!: string;
    @Column({ type: "integer" })
    ordinal!: number;
}

export const toEvaluatorDefinition = (row: EvaluatorDefinitionEntity): EvaluatorDefinition =>
    Object.assign(new EvaluatorDefinition(), row);
export const toEvaluatorDefinitionRow = (model: EvaluatorDefinition): EvaluatorDefinitionEntity =>
    Object.assign(new EvaluatorDefinitionEntity(), model);
export const toEvaluatorSet = (row: EvaluatorSetEntity): EvaluatorSet =>
    Object.assign(new EvaluatorSet(), row);
export const toEvaluatorSetMember = (row: EvaluatorSetMemberEntity): EvaluatorSetMember =>
    Object.assign(new EvaluatorSetMember(), row);
