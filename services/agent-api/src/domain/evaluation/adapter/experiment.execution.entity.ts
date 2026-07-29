import { Column, Entity, PrimaryColumn } from "typeorm";
import type { EvaluationScore, ExperimentExecution } from "../model/experiment.model.js";

@Entity({ name: "experiment_executions" })
export class ExperimentExecutionRow {
    @PrimaryColumn("text") id!: string;
    @Column("text") experimentId!: string;
    @Column("text") variantId!: string;
    @Column("text") exampleId!: string;
    @Column("integer") repetition!: number;
    @Column("text") status!: ExperimentExecution["status"];
    @Column("jsonb", { nullable: true }) output!: Record<string, unknown> | null;
    @Column("text", { nullable: true }) error!: string | null;
    @Column("double precision") costUsd!: number;
    @Column("timestamptz", { nullable: true }) startedAt!: Date | null;
    @Column("timestamptz", { nullable: true }) completedAt!: Date | null;
}

@Entity({ name: "evaluation_scores" })
export class EvaluationScoreRow {
    @PrimaryColumn("text") id!: string;
    @Column("text") executionId!: string;
    @Column("text") evaluatorId!: string;
    @Column("text") evaluatorVersion!: string;
    @Column("double precision") score!: number;
    @Column("text", { nullable: true }) label!: string | null;
    @Column("text", { nullable: true }) reason!: string | null;
    @Column("double precision") judgeCostUsd!: number;
    @Column("timestamptz") createdAt!: Date;
}

export function toExperimentExecution(row: ExperimentExecutionRow): ExperimentExecution {
    return { ...row };
}
export function toExperimentExecutionRow(model: ExperimentExecution): ExperimentExecutionRow {
    return Object.assign(new ExperimentExecutionRow(), model);
}
export function toEvaluationScore(row: EvaluationScoreRow): EvaluationScore {
    return { ...row };
}
export function toEvaluationScoreRow(model: EvaluationScore): EvaluationScoreRow {
    return Object.assign(new EvaluationScoreRow(), model);
}
