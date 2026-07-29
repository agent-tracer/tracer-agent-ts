import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    acceptsExample,
    buildSftEntry,
    hashExport,
    minimumScore,
} from "~agent-api/domain/evaluation/model/training.export.builder.js";
import type {
    ExportFilteringPolicy,
    ExportManifest,
    SftExportEntry,
} from "~agent-api/domain/evaluation/model/training.export.model.js";
import { EVALUATION_CLOCK, type EvaluationClockPort } from "~agent-api/domain/evaluation/port/clock.port.js";
import { EVALUATION_REPOSITORY, type EvaluationRepositoryPort } from "~agent-api/domain/evaluation/port/evaluation.repository.port.js";

@Injectable()
export class ExportSftUseCase {
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
    ): Promise<{ manifest: ExportManifest; entries: SftExportEntry[] }> {
        if (await this.repository.findDataset(userId, datasetId) === null) {
            throw new NotFoundException("Dataset not found");
        }
        if (await this.repository.findExperiment(userId, experimentId) === null) {
            throw new NotFoundException("Experiment not found");
        }
        const examples = await this.repository.listExamples(userId, datasetId, datasetRevision);
        const executions = await this.repository.listExecutions(userId, experimentId);
        const byExample = new Map(executions.map((execution) => [execution.exampleId, execution]));
        const entries: SftExportEntry[] = [];
        for (const example of examples) {
            if (!acceptsExample(example, policy)) continue;
            const execution = byExample.get(example.id);
            if (execution?.status !== "succeeded" || execution.output === null) continue;
            if (policy.minScore !== null) {
                const score = minimumScore(await this.repository.listScores(userId, execution.id));
                if (score === null || score < policy.minScore) continue;
            }
            entries.push(buildSftEntry(example, execution));
        }
        return {
            manifest: {
                datasetId,
                datasetRevision,
                filteringPolicy: policy,
                entryCount: entries.length,
                contentHash: hashExport(entries),
                exportedAt: this.clock.now().toISOString(),
                format: "sft-jsonl",
            },
            entries,
        };
    }
}
