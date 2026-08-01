import type { DataSource } from "typeorm";
import { upsertByKeys } from "~agent-api/config/typeorm.upsert.js";
import type { Experiment, ExperimentExecution, ExperimentVariant } from "../model/experiment.model.js";
import type { HumanReview, HumanReviewRevision } from "../model/human.review.model.js";
import type { ExperimentExampleSummary } from "../model/experiment.preview.model.js";
import type { ExperimentRepositoryPort } from "../port/experiment.repository.port.js";
import type { EvaluationScoreRow } from "./experiment.execution.entity.js";
import { ExperimentExecutionRow, toEvaluationScore, toExperimentExecution, toExperimentExecutionRow } from "./experiment.execution.entity.js";
import { ExperimentRow, ExperimentVariantRow, toExperiment, toExperimentRow, toExperimentVariant, toExperimentVariantRow } from "./experiment.entity.js";
import { HumanReviewRevisionRow, HumanReviewRow, toHumanReview, toHumanReviewRevisionRow, toHumanReviewRow } from "./human.review.entity.js";

/** 실험과 사람 검토 상태를 TypeORM으로 보존한다. */
export class TypeOrmExperimentRepository implements ExperimentRepositoryPort {
    constructor(private readonly source: DataSource) {}

    async saveExperiment(experiment: Experiment, variants: readonly ExperimentVariant[]): Promise<void> {
        await this.source.transaction(async (manager) => {
            await upsertByKeys(manager.getRepository(ExperimentRow), toExperimentRow(experiment), ["id"]);
            for (const variant of variants) {
                await upsertByKeys(manager.getRepository(ExperimentVariantRow), toExperimentVariantRow(variant), ["id"]);
            }
        });
    }

    async saveExecutions(executions: readonly ExperimentExecution[]): Promise<void> {
        if (executions.length === 0) return;
        await this.source.transaction(async (manager) => {
            for (const execution of executions) {
                await upsertByKeys(manager.getRepository(ExperimentExecutionRow), toExperimentExecutionRow(execution), ["id"]);
            }
        });
    }

    async findExperiment(userId: string, id: string): Promise<Experiment | null> {
        const row = await this.source.getRepository(ExperimentRow).findOne({ where: { id, userId } });
        return row === null ? null : toExperiment(row);
    }

    async listExperiments(userId: string): Promise<Experiment[]> {
        return (await this.source.getRepository(ExperimentRow).find({ where: { userId }, order: { createdAt: "DESC" } })).map(toExperiment);
    }

    async listVariants(userId: string, experimentId: string): Promise<ExperimentVariant[]> {
        if (await this.findExperiment(userId, experimentId) === null) return [];
        return (await this.source.getRepository(ExperimentVariantRow).find({ where: { experimentId }, order: { id: "ASC" } })).map(toExperimentVariant);
    }

    async listExamples(userId: string, datasetId: string, revision: number): Promise<ExperimentExampleSummary[]> {
        return this.source.query(
            `SELECT e.id, e.disclosure_class AS "disclosureClass" FROM evaluation_examples e
             JOIN evaluation_datasets d ON d.id = e.dataset_id
             WHERE d.user_id = $1 AND e.dataset_id = $2 AND e.revision = $3 AND e.enabled = true ORDER BY e.id`,
            [userId, datasetId, revision],
        );
    }

    async referencesExist(userId: string, datasetId: string, revision: number, evaluatorSetVersion: string): Promise<boolean> {
        const rows: { valid: boolean }[] = await this.source.query(
            `SELECT EXISTS(SELECT 1 FROM evaluation_datasets d JOIN evaluation_examples e ON e.dataset_id = d.id
              WHERE d.user_id = $1 AND d.id = $2 AND e.revision = $3)
              AND EXISTS(SELECT 1 FROM evaluator_sets WHERE version = $4) AS valid`,
            [userId, datasetId, revision, evaluatorSetVersion],
        );
        return rows[0]?.valid ?? false;
    }

    async claimDraft(userId: string, id: string): Promise<Experiment | null> {
        const rows: ExperimentRow[] = await this.source.query(
            `UPDATE experiments SET status = 'running' WHERE id = $1 AND user_id = $2 AND status = 'draft' RETURNING *`,
            [id, userId],
        );
        return rows[0] === undefined ? null : toExperiment(rows[0]);
    }

    async restoreDraft(userId: string, id: string): Promise<void> {
        await this.source.getRepository(ExperimentRow).update({ id, userId, status: "running" }, { status: "draft" });
    }

    async listExecutions(userId: string, experimentId: string) {
        if (await this.findExperiment(userId, experimentId) === null) return [];
        return (await this.source.getRepository(ExperimentExecutionRow).find({ where: { experimentId }, order: { id: "ASC" } })).map(toExperimentExecution);
    }

    async listScores(userId: string, experimentId: string) {
        if (await this.findExperiment(userId, experimentId) === null) return [];
        const rows: EvaluationScoreRow[] = await this.source.query(
            `SELECT s.* FROM evaluation_scores s JOIN experiment_executions e ON e.id = s.execution_id WHERE e.experiment_id = $1`,
            [experimentId],
        );
        return rows.map(toEvaluationScore);
    }

    async listReviews(userId: string, experimentId: string): Promise<HumanReview[]> {
        return (await this.source.getRepository(HumanReviewRow).find({ where: { userId, experimentId }, order: { createdAt: "ASC" } })).map(toHumanReview);
    }

    async saveReview(review: HumanReview, revision: HumanReviewRevision): Promise<void> {
        await this.source.transaction(async (manager) => {
            await upsertByKeys(manager.getRepository(HumanReviewRow), toHumanReviewRow(review), ["id"]);
            await upsertByKeys(manager.getRepository(HumanReviewRevisionRow), toHumanReviewRevisionRow(revision), ["id"]);
        });
    }
}
