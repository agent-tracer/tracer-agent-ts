import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { EvaluationDataset, EvaluationExample } from "../model/dataset.model.js";
import type { DisclosureClass } from "../model/evaluation.types.js";

/** 평가 데이터셋의 PostgreSQL 저장 스키마다. */
@Entity({ name: "evaluation_datasets" })
@Index("evaluation_datasets_user_name", ["userId", "name"], { unique: true })
export class EvaluationDatasetEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    name!: string;

    @Column({ type: "text", default: "" })
    description!: string;

    @Column({ name: "current_revision", type: "integer", default: 1 })
    currentRevision!: number;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}

/** 평가 사례의 PostgreSQL 저장 스키마다. */
@Entity({ name: "evaluation_examples" })
@Index("evaluation_examples_dataset_revision_hash", ["datasetId", "revision", "contentHash"], { unique: true })
@Index("evaluation_examples_dataset_revision", ["datasetId", "revision"])
export class EvaluationExampleEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "dataset_id", type: "text" })
    datasetId!: string;

    @Column({ type: "integer" })
    revision!: number;

    @Column({ type: "jsonb" })
    input!: Record<string, unknown>;

    @Column({ name: "reference_output", type: "jsonb", nullable: true })
    referenceOutput!: Record<string, unknown> | null;

    @Column({ type: "jsonb", default: {} })
    metadata!: Record<string, unknown>;

    @Column({ name: "disclosure_class", type: "text" })
    disclosureClass!: DisclosureClass;

    @Column({ name: "source_execution_id", type: "text", nullable: true })
    sourceExecutionId!: string | null;

    @Column({ name: "content_hash", type: "text" })
    contentHash!: string;

    @Column({ type: "jsonb", default: {} })
    evidence!: Record<string, unknown>;

    @Column({ type: "boolean", default: true })
    enabled!: boolean;
}

export function toEvaluationDataset(row: EvaluationDatasetEntity): EvaluationDataset {
    return Object.assign(new EvaluationDataset(), row);
}

export function toEvaluationDatasetRow(model: EvaluationDataset): EvaluationDatasetEntity {
    return Object.assign(new EvaluationDatasetEntity(), model);
}

export function toEvaluationExample(row: EvaluationExampleEntity): EvaluationExample {
    return Object.assign(new EvaluationExample(), row);
}

export function toEvaluationExampleRow(model: EvaluationExample): EvaluationExampleEntity {
    return Object.assign(new EvaluationExampleEntity(), model);
}
