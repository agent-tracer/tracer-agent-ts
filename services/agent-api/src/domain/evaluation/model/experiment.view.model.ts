import type { Experiment } from "./experiment.model.js";

/** 실험을 부른 사람이 곧 소유자이므로 밖으로 내는 실험에는 소유자 식별자를 싣지 않는다. */
export interface ExperimentView {
    readonly id: string;
    readonly datasetId: string;
    readonly datasetRevision: number;
    readonly evaluatorSetVersion: string;
    readonly maxBudgetUsd: number;
    readonly repetitions: number;
    readonly status: Experiment["status"];
    readonly createdAt: Date;
    readonly completedAt: Date | null;
}

export function toExperimentView(experiment: Experiment): ExperimentView {
    return {
        id: experiment.id,
        datasetId: experiment.datasetId,
        datasetRevision: experiment.datasetRevision,
        evaluatorSetVersion: experiment.evaluatorSetVersion,
        maxBudgetUsd: experiment.maxBudgetUsd,
        repetitions: experiment.repetitions,
        status: experiment.status,
        createdAt: experiment.createdAt,
        completedAt: experiment.completedAt,
    };
}
