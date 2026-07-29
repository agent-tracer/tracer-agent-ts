import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    acceptsExample,
    buildDpoEntry,
    hashExport,
} from "~agent-api/domain/evaluation/model/training.export.builder.js";
import type {
    DpoExportEntry,
    ExportFilteringPolicy,
    ExportManifest,
} from "~agent-api/domain/evaluation/model/training.export.model.js";
import { EVALUATION_CLOCK, type EvaluationClockPort } from "~agent-api/domain/evaluation/port/clock.port.js";
import {
    EVALUATION_REPOSITORY,
    type EvaluationExecutionView,
    type EvaluationRepositoryPort,
} from "~agent-api/domain/evaluation/port/evaluation.repository.port.js";

interface ScoredExecution {
    readonly execution: EvaluationExecutionView;
    readonly score: number;
}

@Injectable()
export class ExportDpoUseCase {
    constructor(
        @Inject(EVALUATION_REPOSITORY) private readonly repository: EvaluationRepositoryPort,
        @Inject(EVALUATION_CLOCK) private readonly clock: EvaluationClockPort,
    ) {}

    async execute(
        userId: string,
        datasetId: string,
        datasetRevision: number,
        experimentId: string,
        policy: ExportFilteringPolicy,
    ): Promise<{ manifest: ExportManifest; entries: DpoExportEntry[] }> {
        if (await this.repository.findDataset(userId, datasetId) === null) {
            throw new NotFoundException("Dataset not found");
        }
        if (await this.repository.findExperiment(userId, experimentId) === null) {
            throw new NotFoundException("Experiment not found");
        }
        const examples = await this.repository.listExamples(userId, datasetId, datasetRevision);
        const executions = await this.repository.listExecutions(userId, experimentId);
        const entries: DpoExportEntry[] = [];
        for (const example of examples) {
            if (!acceptsExample(example, policy)) continue;
            const scored = await this.scoreExecutions(
                userId,
                executions.filter((execution) =>
                    execution.exampleId === example.id
                    && execution.status === "succeeded"
                    && execution.output !== null,
                ),
            );
            scored.sort((left, right) => right.score - left.score);
            const chosen = scored[0];
            const rejected = scored.at(-1);
            if (chosen === undefined || rejected === undefined || chosen.score <= rejected.score) continue;
            entries.push(buildDpoEntry(example, chosen.execution, rejected.execution));
        }
        return {
            manifest: {
                datasetId,
                datasetRevision,
                filteringPolicy: policy,
                entryCount: entries.length,
                contentHash: hashExport(entries),
                exportedAt: this.clock.now().toISOString(),
                format: "dpo-jsonl",
            },
            entries,
        };
    }

    private async scoreExecutions(
        userId: string,
        executions: readonly EvaluationExecutionView[],
    ): Promise<ScoredExecution[]> {
        return Promise.all(executions.map(async (execution) => {
            const scores = await this.repository.listScores(userId, execution.id);
            const total = scores.reduce((sum, item) => sum + (item.score ?? 0), 0);
            return { execution, score: total / Math.max(scores.length, 1) };
        }));
    }
}
