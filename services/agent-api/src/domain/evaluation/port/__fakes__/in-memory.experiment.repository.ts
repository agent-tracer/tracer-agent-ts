import { isLeasable, leased } from "~agent-api/domain/evaluation/model/evaluation.execution.policy.js";
import type {
    EvaluationExecutionSettlementRecord,
    EvaluationScore,
    Experiment,
    ExperimentExecution,
    ExperimentStatus,
    ExperimentVariant,
} from "~agent-api/domain/evaluation/model/experiment.model.js";
import type { HumanReview, HumanReviewRevision } from "~agent-api/domain/evaluation/model/human.review.model.js";
import type { ExperimentExampleSummary } from "~agent-api/domain/evaluation/model/experiment.preview.model.js";
import type { ExecutionContext, ExperimentRepositoryPort } from "../experiment.repository.port.js";

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
    async saveExecutions(executions: readonly ExperimentExecution[]): Promise<void> {
        for (const execution of executions) {
            const at = this.executions.findIndex((row) => row.id === execution.id);
            if (at >= 0) this.executions[at] = execution;
            else this.executions.push(execution);
        }
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

    readonly settlements: EvaluationExecutionSettlementRecord[] = [];
    context: ExecutionContext | null = null;

    async leaseExecution(userId: string, experimentId: string, executionId: string | null, owner: string, now: Date): Promise<ExperimentExecution | null> {
        if (await this.findExperiment(userId, experimentId) === null) return null;
        const at = this.executions.findIndex((row) =>
            row.experimentId === experimentId
            && (executionId === null || row.id === executionId)
            && isLeasable(row, now));
        if (at < 0) return null;
        const next = leased(this.executions[at] as ExperimentExecution, owner, now);
        this.executions[at] = next;
        return next;
    }

    async findExecution(userId: string, executionId: string): Promise<ExperimentExecution | null> {
        const row = this.executions.find((execution) => execution.id === executionId) ?? null;
        if (row === null) return null;
        return await this.findExperiment(userId, row.experimentId) === null ? null : row;
    }

    async loadExecutionContext(_userId: string, _execution: ExperimentExecution): Promise<ExecutionContext | null> {
        return this.context;
    }

    async saveExecution(execution: ExperimentExecution): Promise<void> {
        await this.saveExecutions([execution]);
    }

    async recordSettlement(record: EvaluationExecutionSettlementRecord): Promise<boolean> {
        const seen = this.settlements.some((row) => row.executionId === record.executionId && row.attempt === record.attempt);
        if (seen) return false;
        this.settlements.push(record);
        return true;
    }

    async saveScores(scores: readonly EvaluationScore[]): Promise<void> {
        this.scores.push(...scores);
    }

    async spentCostUsd(_userId: string, experimentId: string): Promise<number> {
        return this.executions
            .filter((row) => row.experimentId === experimentId)
            .reduce((total, row) => total + row.costUsd, 0);
    }

    async finalizeExperiment(userId: string, experimentId: string, status: ExperimentStatus, completedAt: Date): Promise<ExperimentStatus | null> {
        const row = await this.findExperiment(userId, experimentId);
        if (row === null) return null;
        if (row.status === "completed" || row.status === "failed" || row.status === "cancelled") return row.status;
        row.status = status;
        row.completedAt = completedAt;
        return status;
    }
}
