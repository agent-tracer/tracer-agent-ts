import { EvaluationDataset, EvaluationExample } from "~agent-api/domain/evaluation/model/dataset.model.js";
import {
    EvaluatorDefinition,
    type EvaluatorSetComposition,
} from "~agent-api/domain/evaluation/model/evaluator.model.js";
import type {
    EvaluationExecutionView,
    EvaluationExperimentView,
    EvaluationRepositoryPort,
    EvaluationScoreView,
} from "../evaluation.repository.port.js";

const copyDataset = (row: EvaluationDataset): EvaluationDataset => Object.assign(new EvaluationDataset(), row);
const copyExample = (row: EvaluationExample): EvaluationExample => Object.assign(new EvaluationExample(), row);
const copyEvaluator = (row: EvaluatorDefinition): EvaluatorDefinition => Object.assign(new EvaluatorDefinition(), row);

/** 평가 저장소의 소유권과 개정 조회를 재현하는 인메모리 대역이다. */
export class InMemoryEvaluationRepository implements EvaluationRepositoryPort {
    private readonly datasets = new Map<string, EvaluationDataset>();
    private readonly examples = new Map<string, EvaluationExample>();
    private readonly evaluators = new Map<string, EvaluatorDefinition>();
    private readonly experiments = new Map<string, EvaluationExperimentView & { userId: string }>();
    private readonly executions = new Map<string, EvaluationExecutionView[]>();
    private readonly scores = new Map<string, EvaluationScoreView[]>();
    private evaluatorSet: EvaluatorSetComposition | null = null;

    seedExperiment(userId: string, experiment: EvaluationExperimentView): void {
        this.experiments.set(experiment.id, { ...experiment, userId });
    }

    seedExecutions(experimentId: string, rows: readonly EvaluationExecutionView[]): void {
        this.executions.set(experimentId, [...rows]);
    }

    seedScores(executionId: string, rows: readonly EvaluationScoreView[]): void {
        this.scores.set(executionId, [...rows]);
    }

    seedEvaluatorSet(composition: EvaluatorSetComposition): void {
        this.evaluatorSet = composition;
    }

    async saveDataset(dataset: EvaluationDataset, examples: readonly EvaluationExample[]): Promise<void> {
        this.datasets.set(dataset.id, copyDataset(dataset));
        for (const example of examples) this.examples.set(example.id, copyExample(example));
    }

    async findDataset(userId: string, id: string): Promise<EvaluationDataset | null> {
        const row = this.datasets.get(id);
        return row?.userId === userId ? copyDataset(row) : null;
    }

    async listDatasets(userId: string): Promise<EvaluationDataset[]> {
        return [...this.datasets.values()]
            .filter((row) => row.userId === userId)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
            .map(copyDataset);
    }

    async deleteDataset(userId: string, id: string): Promise<boolean> {
        const row = this.datasets.get(id);
        return row?.userId === userId && this.datasets.delete(id);
    }

    async listExamples(userId: string, datasetId: string, revision: number): Promise<EvaluationExample[]> {
        if (await this.findDataset(userId, datasetId) === null) return [];
        return [...this.examples.values()]
            .filter((row) => row.datasetId === datasetId && row.revision === revision)
            .sort((left, right) => left.id.localeCompare(right.id))
            .map(copyExample);
    }

    async hasStartedExperiment(userId: string, datasetId: string): Promise<boolean> {
        return [...this.experiments.values()].some((row) =>
            row.userId === userId && row.datasetId === datasetId && row.status !== "draft",
        );
    }

    async saveEvaluatorDefinition(definition: EvaluatorDefinition): Promise<void> {
        this.evaluators.set(definition.id, copyEvaluator(definition));
    }

    async listEvaluatorDefinitions(): Promise<EvaluatorDefinition[]> {
        return [...this.evaluators.values()].filter((row) => row.enabled).map(copyEvaluator);
    }

    async findEvaluatorSet(version: string): Promise<EvaluatorSetComposition | null> {
        return this.evaluatorSet?.set.version === version ? this.evaluatorSet : null;
    }

    async findExperiment(userId: string, id: string): Promise<EvaluationExperimentView | null> {
        const row = this.experiments.get(id);
        return row?.userId === userId ? row : null;
    }

    async listExecutions(userId: string, experimentId: string): Promise<EvaluationExecutionView[]> {
        return await this.findExperiment(userId, experimentId) === null
            ? []
            : [...(this.executions.get(experimentId) ?? [])];
    }

    async listScores(userId: string, executionId: string): Promise<EvaluationScoreView[]> {
        const ownsExecution = [...this.experiments.values()]
            .filter((experiment) => experiment.userId === userId)
            .some((experiment) => (this.executions.get(experiment.id) ?? []).some((row) => row.id === executionId));
        return ownsExecution ? [...(this.scores.get(executionId) ?? [])] : [];
    }
}
