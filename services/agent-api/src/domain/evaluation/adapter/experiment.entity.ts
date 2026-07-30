import { Column, Entity, PrimaryColumn } from "typeorm";
import type { Experiment, ExperimentVariant } from "../model/experiment.model.js";

@Entity({ name: "experiments" })
export class ExperimentRow {
    @PrimaryColumn("text") id!: string;
    @Column({ name: "user_id", type: "text" }) userId!: string;
    @Column({ name: "dataset_id", type: "text" }) datasetId!: string;
    @Column({ name: "dataset_revision", type: "integer" }) datasetRevision!: number;
    @Column({ name: "evaluator_set_version", type: "text" }) evaluatorSetVersion!: string;
    @Column({ name: "max_budget_usd", type: "double precision" }) maxBudgetUsd!: number;
    @Column("integer") repetitions!: number;
    @Column("text") status!: Experiment["status"];
    @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
    @Column({ name: "completed_at", type: "timestamptz", nullable: true }) completedAt!: Date | null;
}

@Entity({ name: "experiment_variants" })
export class ExperimentVariantRow {
    @PrimaryColumn("text") id!: string;
    @Column({ name: "experiment_id", type: "text" }) experimentId!: string;
    @Column("text") name!: string;
    @Column("boolean") baseline!: boolean;
    @Column("text") backend!: ExperimentVariant["backend"];
    @Column({ name: "agent_name", type: "text" }) agentName!: string;
    @Column({ name: "prompt_version_id", type: "text", nullable: true }) promptVersionId!: string | null;
    @Column({ name: "tool_contract_version", type: "text" }) toolContractVersion!: string;
    @Column("jsonb") limits!: Readonly<Record<string, unknown>>;
    @Column({ name: "fragment_selections", type: "jsonb" }) fragmentSelections!: Readonly<Record<string, string>>;
}

export function toExperiment(row: ExperimentRow): Experiment {
    return { ...row };
}

export function toExperimentRow(model: Experiment): ExperimentRow {
    return Object.assign(new ExperimentRow(), model);
}

export function toExperimentVariant(row: ExperimentVariantRow): ExperimentVariant {
    return { ...row };
}

export function toExperimentVariantRow(model: ExperimentVariant): ExperimentVariantRow {
    return Object.assign(new ExperimentVariantRow(), model);
}
