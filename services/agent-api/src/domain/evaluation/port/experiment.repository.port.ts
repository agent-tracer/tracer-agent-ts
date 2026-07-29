import type {
    EvaluationScore,
    Experiment,
    ExperimentExecution,
    ExperimentVariant,
} from "../model/experiment.model.js";
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
    listExecutions(userId: string, experimentId: string): Promise<readonly ExperimentExecution[]>;
    listScores(userId: string, experimentId: string): Promise<readonly EvaluationScore[]>;
    listReviews(userId: string, experimentId: string): Promise<readonly HumanReview[]>;
    saveReview(review: HumanReview, revision: HumanReviewRevision): Promise<void>;
}
