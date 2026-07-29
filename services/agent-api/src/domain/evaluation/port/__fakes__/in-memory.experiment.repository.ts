import type {
    EvaluationScore,
    Experiment,
    ExperimentExecution,
    ExperimentVariant,
} from "~agent-api/domain/evaluation/model/experiment.model.js";
import type { HumanReview, HumanReviewRevision } from "~agent-api/domain/evaluation/model/human.review.model.js";
import type { ExperimentExampleSummary } from "~agent-api/domain/evaluation/model/experiment.preview.model.js";
import type { ExperimentRepositoryPort } from "../experiment.repository.port.js";

export class InMemoryExperimentRepository implements ExperimentRepositoryPort {
    readonly experiments: Experiment[] = [];
    readonly variants: ExperimentVariant[] = [];
    readonly examples: ExperimentExampleSummary[] = [];
    readonly executions: ExperimentExecution[] = [];
    readonly scores: EvaluationScore[] = [];
    readonly reviews: HumanReview[] = [];
    readonly revisions: HumanReviewRevision[] = [];
    referencesValid = true;

    async saveExperiment(experiment: Experiment, variants: readonly ExperimentVariant[]): Promise<void> {
        const index = this.experiments.findIndex((row) => row.id === experiment.id);
        if (index < 0) this.experiments.push(experiment);
        else this.experiments[index] = experiment;
        this.variants.splice(0, this.variants.length, ...this.variants.filter((row) => row.experimentId !== experiment.id), ...variants);
    }
    async findExperiment(userId: string, id: string): Promise<Experiment | null> {
        return this.experiments.find((row) => row.userId === userId && row.id === id) ?? null;
    }
    async listExperiments(userId: string): Promise<readonly Experiment[]> {
        return this.experiments.filter((row) => row.userId === userId);
    }
    async listVariants(_userId: string, experimentId: string): Promise<readonly ExperimentVariant[]> {
        return this.variants.filter((row) => row.experimentId === experimentId);
    }
    async listExamples(_userId: string, _datasetId: string, _revision: number): Promise<readonly ExperimentExampleSummary[]> {
        return this.examples;
    }
    async referencesExist(): Promise<boolean> {
        return this.referencesValid;
    }
    async claimDraft(userId: string, id: string): Promise<Experiment | null> {
        const row = await this.findExperiment(userId, id);
        if (row === null || row.status !== "draft") return null;
        row.status = "running";
        return row;
    }
    async restoreDraft(userId: string, id: string): Promise<void> {
        const row = await this.findExperiment(userId, id);
        if (row !== null) row.status = "draft";
    }
    async listExecutions(_userId: string, experimentId: string): Promise<readonly ExperimentExecution[]> {
        return this.executions.filter((row) => row.experimentId === experimentId);
    }
    async listScores(): Promise<readonly EvaluationScore[]> {
        return this.scores;
    }
    async listReviews(_userId: string, experimentId: string): Promise<readonly HumanReview[]> {
        return this.reviews.filter((row) => row.experimentId === experimentId);
    }
    async saveReview(review: HumanReview, revision: HumanReviewRevision): Promise<void> {
        const index = this.reviews.findIndex((row) => row.id === review.id);
        if (index < 0) this.reviews.push(review);
        else this.reviews[index] = review;
        this.revisions.push(revision);
    }
}
