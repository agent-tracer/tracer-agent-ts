import type { Repository } from "typeorm";
import { upsertByKeys } from "~agent-api/config/typeorm.upsert.js";
import type { EvaluationDataset, EvaluationExample } from "../model/dataset.model.js";
import type {
    EvaluatorDefinition,
    EvaluatorSetComposition,
} from "../model/evaluator.model.js";
import type { EvaluationExecutionView, EvaluationExperimentView, EvaluationScoreView } from "../model/evaluation.persistence.view.model.js";
import type { EvaluationRepositoryPort } from "../port/evaluation.repository.port.js";
import {
    EvaluationDatasetEntity,
    EvaluationExampleEntity,
    toEvaluationDataset,
    toEvaluationDatasetRow,
    toEvaluationExample,
    toEvaluationExampleRow,
} from "./dataset.entity.js";
import type {
    EvaluatorDefinitionEntity,
    EvaluatorSetEntity,
    EvaluatorSetMemberEntity} from "./evaluator.entity.js";
import {
    toEvaluatorDefinition,
    toEvaluatorDefinitionRow,
    toEvaluatorSet,
    toEvaluatorSetMember,
} from "./evaluator.entity.js";

interface EvaluationPersistenceRepositories {
    readonly datasets: Repository<EvaluationDatasetEntity>;
    readonly examples: Repository<EvaluationExampleEntity>;
    readonly evaluators: Repository<EvaluatorDefinitionEntity>;
    readonly evaluatorSets: Repository<EvaluatorSetEntity>;
    readonly evaluatorMembers: Repository<EvaluatorSetMemberEntity>;
}

/** 평가 데이터와 평가자 카탈로그를 TypeORM으로 보존한다. */
export class TypeOrmEvaluationRepository implements EvaluationRepositoryPort {
    constructor(private readonly repos: EvaluationPersistenceRepositories) {}

    async saveDataset(dataset: EvaluationDataset, examples: readonly EvaluationExample[]): Promise<void> {
        await this.repos.datasets.manager.transaction(async (manager) => {
            await upsertByKeys(manager.getRepository(EvaluationDatasetEntity), toEvaluationDatasetRow(dataset), ["id"]);
            for (const example of examples) {
                await upsertByKeys(
                    manager.getRepository(EvaluationExampleEntity),
                    toEvaluationExampleRow(example),
                    ["id"],
                );
            }
        });
    }

    async findDataset(userId: string, id: string): Promise<EvaluationDataset | null> {
        const row = await this.repos.datasets.findOne({ where: { id, userId } });
        return row === null ? null : toEvaluationDataset(row);
    }

    async listDatasets(userId: string): Promise<EvaluationDataset[]> {
        const rows = await this.repos.datasets.find({
            where: { userId },
            order: { createdAt: "DESC", id: "ASC" },
        });
        return rows.map(toEvaluationDataset);
    }

    async deleteDataset(userId: string, id: string): Promise<boolean> {
        const result = await this.repos.datasets.delete({ id, userId });
        return (result.affected ?? 0) > 0;
    }

    async listExamples(userId: string, datasetId: string, revision: number): Promise<EvaluationExample[]> {
        if (await this.findDataset(userId, datasetId) === null) return [];
        const rows = await this.repos.examples.find({
            where: { datasetId, revision },
            order: { id: "ASC" },
        });
        return rows.map(toEvaluationExample);
    }

    async hasStartedExperiment(userId: string, datasetId: string): Promise<boolean> {
        const rows: { count: string }[] = await this.repos.datasets.query(
            `SELECT count(*) AS count FROM evaluation_experiments
             WHERE user_id = $1 AND dataset_id = $2 AND status <> 'draft'`,
            [userId, datasetId],
        );
        return Number(rows[0]?.count ?? 0) > 0;
    }

    async saveEvaluatorDefinition(definition: EvaluatorDefinition): Promise<void> {
        await upsertByKeys(this.repos.evaluators, toEvaluatorDefinitionRow(definition), ["id"]);
    }

    async listEvaluatorDefinitions(): Promise<EvaluatorDefinition[]> {
        const rows = await this.repos.evaluators.find({
            where: { enabled: true },
            order: { name: "ASC", version: "DESC" },
        });
        return rows.map(toEvaluatorDefinition);
    }

    async findEvaluatorSet(version: string): Promise<EvaluatorSetComposition | null> {
        const set = await this.repos.evaluatorSets.findOne({ where: { version } });
        if (set === null) return null;
        const memberships = await this.repos.evaluatorMembers.find({
            where: { setId: set.id },
            order: { ordinal: "ASC" },
        });
        const members = await Promise.all(memberships.map(async (membership) => {
            const evaluator = await this.repos.evaluators.findOne({
                where: { id: membership.evaluatorDefinitionId },
            });
            return evaluator === null ? null : {
                membership: toEvaluatorSetMember(membership),
                evaluator: toEvaluatorDefinition(evaluator),
            };
        }));
        if (members.length === 0 || members.some((row) => row === null)) return null;
        return { set: toEvaluatorSet(set), members: members.filter((row) => row !== null) };
    }

    async findExperiment(userId: string, id: string): Promise<EvaluationExperimentView | null> {
        const rows: EvaluationExperimentView[] = await this.repos.datasets.query(
            `SELECT id, dataset_id AS "datasetId", dataset_revision AS "datasetRevision", status
             FROM evaluation_experiments WHERE id = $1 AND user_id = $2`,
            [id, userId],
        );
        return rows[0] ?? null;
    }

    async listExecutions(userId: string, experimentId: string): Promise<EvaluationExecutionView[]> {
        return this.repos.datasets.query(
            `SELECT e.id, e.example_id AS "exampleId", e.variant_id AS "variantId", e.status, e.output
             FROM experiment_executions e JOIN evaluation_experiments x ON x.id = e.experiment_id
             WHERE e.experiment_id = $1 AND x.user_id = $2`,
            [experimentId, userId],
        );
    }

    async listScores(userId: string, executionId: string): Promise<EvaluationScoreView[]> {
        return this.repos.datasets.query(
            `SELECT s.score FROM evaluation_scores s
             JOIN experiment_executions e ON e.id = s.execution_id
             JOIN evaluation_experiments x ON x.id = e.experiment_id
             WHERE s.execution_id = $1 AND x.user_id = $2`,
            [executionId, userId],
        );
    }
}
