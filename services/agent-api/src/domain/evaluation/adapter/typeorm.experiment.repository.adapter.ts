import type { DataSource } from "typeorm";
import { upsertByKeys } from "~agent-api/config/typeorm.upsert.js";
import { EXECUTION_LEASE_MS, isTerminalExperiment } from "../model/evaluation.execution.policy.js";
import type { EvaluationExecutionSettlementRecord, EvaluationScore, Experiment, ExperimentExecution, ExperimentStatus, ExperimentVariant } from "../model/experiment.model.js";
import type { HumanReview, HumanReviewRevision } from "../model/human.review.model.js";
import type { ExperimentExampleSummary } from "../model/experiment.preview.model.js";
import type { ExecutionContext, ExperimentRepositoryPort } from "../port/experiment.repository.port.js";
import { EvaluationScoreRow, ExperimentExecutionRow, toEvaluationScore, toEvaluationScoreRow, toExperimentExecution, toExperimentExecutionRow } from "./experiment.execution.entity.js";
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

    async leaseExecution(userId: string, experimentId: string, executionId: string | null, owner: string, now: Date): Promise<ExperimentExecution | null> {
        if (await this.findExperiment(userId, experimentId) === null) return null;
        // 고르는 것과 잡는 것이 한 문장이라 같은 실행을 두 워커가 함께 가져가지 못한다.
        const rows: ExperimentExecutionRow[] = await this.source.query(
            `UPDATE experiment_executions SET
                 status = 'running',
                 attempt_count = attempt_count + 1,
                 lease_owner = $3,
                 lease_expires_at = $4,
                 started_at = COALESCE(started_at, $5)
             WHERE id = (
                 SELECT id FROM experiment_executions
                 WHERE experiment_id = $1
                   AND ($2::text IS NULL OR id = $2)
                   AND (status = 'pending' OR (status = 'running' AND lease_expires_at <= $5))
                 ORDER BY id
                 FOR UPDATE SKIP LOCKED
                 LIMIT 1
             )
             RETURNING *`,
            [experimentId, executionId, owner, new Date(now.getTime() + EXECUTION_LEASE_MS), now],
        );
        const row = rows[0];
        return row === undefined ? null : toExperimentExecution(row);
    }

    async findExecution(userId: string, executionId: string): Promise<ExperimentExecution | null> {
        const rows: ExperimentExecutionRow[] = await this.source.query(
            `SELECT x.* FROM experiment_executions x
             JOIN experiments e ON e.id = x.experiment_id
             WHERE x.id = $1 AND e.user_id = $2`,
            [executionId, userId],
        );
        const row = rows[0];
        return row === undefined ? null : toExperimentExecution(row);
    }

    async loadExecutionContext(userId: string, execution: ExperimentExecution): Promise<ExecutionContext | null> {
        const variantRow = await this.source.getRepository(ExperimentVariantRow).findOne({ where: { id: execution.variantId } });
        if (variantRow === null) return null;
        const examples: Record<string, unknown>[] = await this.source.query(
            `SELECT e.id, e.input, e.evidence, e.reference_output AS "referenceOutput"
             FROM evaluation_examples e JOIN evaluation_datasets d ON d.id = e.dataset_id
             WHERE e.id = $1 AND d.user_id = $2`,
            [execution.exampleId, userId],
        );
        const example = examples[0];
        if (example === undefined) return null;
        const prompts: Record<string, unknown>[] = variantRow.promptVersionId === null
            ? []
            : await this.source.query(`SELECT * FROM prompt_versions WHERE id = $1`, [variantRow.promptVersionId]);
        const evaluatorDefinitions: Record<string, unknown>[] = await this.source.query(
            `SELECT d.* FROM evaluator_definitions d
             JOIN evaluator_set_members m ON m.evaluator_definition_id = d.id
             JOIN evaluator_sets s ON s.id = m.set_id
             JOIN experiments e ON e.evaluator_set_version = s.version
             WHERE e.id = $1 ORDER BY m.ordinal`,
            [execution.experimentId],
        );
        return { variant: toExperimentVariant(variantRow), example, prompt: prompts[0] ?? null, evaluatorDefinitions };
    }

    async saveExecution(execution: ExperimentExecution): Promise<void> {
        await this.saveExecutions([execution]);
    }

    async recordSettlement(record: EvaluationExecutionSettlementRecord): Promise<boolean> {
        // 기본 키가 승자를 정하므로 같은 시도가 다시 오면 아무 행도 들어가지 않는다.
        const inserted: unknown[] = await this.source.query(
            `INSERT INTO evaluation_execution_settlements
                 (execution_id, attempt, job_id, trace_id, resolved_prompt_hash, duration_ms, cost_usd, settled_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (execution_id, attempt) DO NOTHING
             RETURNING execution_id`,
            [record.executionId, record.attempt, record.jobId, record.traceId, record.resolvedPromptHash,
                record.durationMs, record.costUsd, record.settledAt],
        );
        return inserted.length > 0;
    }

    async saveScores(scores: readonly EvaluationScore[]): Promise<void> {
        if (scores.length === 0) return;
        await this.source.transaction(async (manager) => {
            for (const score of scores) {
                await upsertByKeys(manager.getRepository(EvaluationScoreRow), toEvaluationScoreRow(score), ["executionId", "evaluatorId", "evaluatorVersion"]);
            }
        });
    }

    async spentCostUsd(userId: string, experimentId: string): Promise<number> {
        const rows: { spent: string | null }[] = await this.source.query(
            `SELECT SUM(x.cost_usd) AS spent FROM experiment_executions x
             JOIN experiments e ON e.id = x.experiment_id
             WHERE x.experiment_id = $1 AND e.user_id = $2`,
            [experimentId, userId],
        );
        return Number(rows[0]?.spent ?? 0);
    }

    async finalizeExperiment(userId: string, experimentId: string, status: ExperimentStatus, completedAt: Date): Promise<ExperimentStatus | null> {
        const experiment = await this.findExperiment(userId, experimentId);
        if (experiment === null) return null;
        if (isTerminalExperiment(experiment.status)) return experiment.status;
        await this.source.getRepository(ExperimentRow).update({ id: experimentId, userId }, { status, completedAt });
        return status;
    }
}
