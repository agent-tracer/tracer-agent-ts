import type { EvaluationDataset, EvaluationExample } from "../model/dataset.model.js";
import type {
    EvaluatorDefinition,
    EvaluatorSetComposition,
} from "../model/evaluator.model.js";
import type {
    EvaluationExecutionView,
    EvaluationExperimentView,
    EvaluationScoreView,
} from "../model/evaluation.persistence.view.model.js";
export type {
    EvaluationExecutionView,
    EvaluationExperimentView,
    EvaluationScoreView,
} from "../model/evaluation.persistence.view.model.js";

export const EVALUATION_REPOSITORY = Symbol("EvaluationRepository");

/** 평가 슬라이스의 영속 상태를 도메인 타입으로 제공한다. */
export interface EvaluationRepositoryPort {
    saveDataset(dataset: EvaluationDataset, examples: readonly EvaluationExample[]): Promise<void>;
    findDataset(userId: string, id: string): Promise<EvaluationDataset | null>;
    listDatasets(userId: string): Promise<EvaluationDataset[]>;
    deleteDataset(userId: string, id: string): Promise<boolean>;
    listExamples(userId: string, datasetId: string, revision: number): Promise<EvaluationExample[]>;
    hasStartedExperiment(userId: string, datasetId: string): Promise<boolean>;
    saveEvaluatorDefinition(definition: EvaluatorDefinition): Promise<void>;
    listEvaluatorDefinitions(): Promise<EvaluatorDefinition[]>;
    findEvaluatorSet(version: string): Promise<EvaluatorSetComposition | null>;
    findExperiment(userId: string, id: string): Promise<EvaluationExperimentView | null>;
    listExecutions(userId: string, experimentId: string): Promise<EvaluationExecutionView[]>;
    listScores(userId: string, executionId: string): Promise<EvaluationScoreView[]>;
}
