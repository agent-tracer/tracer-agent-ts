import type {
    EvaluationExecutionSettlementRecord,
    EvaluationScore,
    Experiment,
    ExperimentExecution,
    ExperimentStatus,
    ExperimentVariant,
} from "../model/experiment.model.js";

/** 실행 하나를 돌리는 데 필요한 것 전부이며 워커가 이 한 번의 왕복으로 봉투를 편성한다. */
export interface ExecutionContext {
    readonly variant: ExperimentVariant;
    readonly example: Readonly<Record<string, unknown>>;
    readonly prompt: Readonly<Record<string, unknown>> | null;
    readonly evaluatorDefinitions: readonly Readonly<Record<string, unknown>>[];
}
import type { HumanReview, HumanReviewRevision } from "../model/human.review.model.js";
import type { ExperimentExampleSummary } from "../model/experiment.preview.model.js";

export const EXPERIMENT_REPOSITORY = Symbol("ExperimentRepository");

export interface ExperimentRepositoryPort {
    saveExperiment(experiment: Experiment, variants: readonly ExperimentVariant[]): Promise<void>;
    findExperiment(userId: string, id: string): Promise<Experiment | null>;
    listExperiments(userId: string): Promise<readonly Experiment[]>;
    listVariants(userId: string, experimentId: string): Promise<readonly ExperimentVariant[]>;
    listExamples(userId: string, datasetId: string, revision: number): Promise<readonly ExperimentExampleSummary[]>;
    referencesExist(userId: string, datasetId: string, revision: number, evaluatorSetVersion: string): Promise<boolean>;
    claimDraft(userId: string, id: string): Promise<Experiment | null>;
    restoreDraft(userId: string, id: string): Promise<void>;
    saveExecutions(executions: readonly ExperimentExecution[]): Promise<void>;
    /** 가져갈 수 있는 실행 하나를 원자적으로 잡아 시도를 올리며 없으면 null 을 낸다. */
    leaseExecution(userId: string, experimentId: string, executionId: string | null, owner: string, now: Date): Promise<ExperimentExecution | null>;
    findExecution(userId: string, executionId: string): Promise<ExperimentExecution | null>;
    loadExecutionContext(userId: string, execution: ExperimentExecution): Promise<ExecutionContext | null>;
    saveExecution(execution: ExperimentExecution): Promise<void>;
    /** 이번 요청이 원장을 바꿨으면 참이고 이미 적힌 시도이면 거짓이다. */
    recordSettlement(record: EvaluationExecutionSettlementRecord): Promise<boolean>;
    saveScores(scores: readonly EvaluationScore[]): Promise<void>;
    spentCostUsd(userId: string, experimentId: string): Promise<number>;
    finalizeExperiment(userId: string, experimentId: string, status: ExperimentStatus, completedAt: Date): Promise<ExperimentStatus | null>;
    listExecutions(userId: string, experimentId: string): Promise<readonly ExperimentExecution[]>;
    listScores(userId: string, experimentId: string): Promise<readonly EvaluationScore[]>;
    listReviews(userId: string, experimentId: string): Promise<readonly HumanReview[]>;
    saveReview(review: HumanReview, revision: HumanReviewRevision): Promise<void>;
}
