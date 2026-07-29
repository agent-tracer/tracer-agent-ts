import { Column, Entity, PrimaryColumn } from "typeorm";
import type { Experiment, ExperimentVariant } from "../model/experiment.model.js";

@Entity({ name: "experiments" })
export class ExperimentRow {
    @PrimaryColumn("text") id!: string;
    @Column("text") userId!: string;
    @Column("text") datasetId!: string;
    @Column("integer") datasetRevision!: number;
    @Column("text") evaluatorSetVersion!: string;
    @Column("double precision") maxBudgetUsd!: number;
    @Column("integer") repetitions!: number;
    @Column("text") status!: Experiment["status"];
    @Column("timestamptz") createdAt!: Date;
    @Column("timestamptz", { nullable: true }) completedAt!: Date | null;
}

@Entity({ name: "experiment_variants" })
export class ExperimentVariantRow {
    @PrimaryColumn("text") id!: string;
    @Column("text") experimentId!: string;
    @Column("text") name!: string;
    @Column("boolean") baseline!: boolean;
    @Column("text") backend!: ExperimentVariant["backend"];
    @Column("text") agentName!: string;
    @Column("text", { nullable: true }) promptVersionId!: string | null;
    @Column("text") toolContractVersion!: string;
    @Column("jsonb") limits!: Readonly<Record<string, unknown>>;
    @Column("jsonb") fragmentSelections!: Readonly<Record<string, string>>;
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
