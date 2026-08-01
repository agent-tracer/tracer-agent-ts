import type { Experiment, ExperimentExecution } from "./experiment.model.js";

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

/** 누가 실행을 가져갔고 언제까지 쥐는지는 원장 안의 사정이므로 밖으로 내는 실행에 싣지 않는다. */
export type ExecutionView = Omit<ExperimentExecution, "leaseOwner" | "leaseExpiresAt">;

export function toExecutionView(execution: ExperimentExecution): ExecutionView {
    const { leaseOwner: _owner, leaseExpiresAt: _expiry, ...view } = execution;
    return view;
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
