import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DatasetQualityReport } from "~agent-api/domain/evaluation/model/dataset.quality.report.js";
import type { DisclosureClass } from "~agent-api/domain/evaluation/model/evaluation.types.js";
import { EVALUATION_REPOSITORY, type EvaluationRepositoryPort } from "~agent-api/domain/evaluation/port/evaluation.repository.port.js";

@Injectable()
export class GenerateQualityReportUseCase {
    constructor(@Inject(EVALUATION_REPOSITORY) private readonly repository: EvaluationRepositoryPort) {}

    async execute(userId: string, datasetId: string): Promise<DatasetQualityReport> {
        const dataset = await this.repository.findDataset(userId, datasetId);
        if (dataset === null) throw new NotFoundException("Dataset not found");
        const examples = await this.repository.listExamples(userId, datasetId, dataset.currentRevision);
        const hashCounts = new Map<string, number>();
        const disclosureDistribution: Partial<Record<DisclosureClass, number>> = {};
        for (const example of examples) {
            hashCounts.set(example.contentHash, (hashCounts.get(example.contentHash) ?? 0) + 1);
            disclosureDistribution[example.disclosureClass] =
                (disclosureDistribution[example.disclosureClass] ?? 0) + 1;
        }
        const collisions = [...hashCounts.values()].reduce(
            (total, count) => total + Math.max(0, count - 1),
            0,
        );
        const duplicateRate = examples.length === 0 ? 0 : collisions / examples.length;
        return {
            datasetId,
            revision: dataset.currentRevision,
            totalExamples: examples.length,
            enabledExamples: examples.filter((example) => example.enabled).length,
            duplicateRate,
            labelDistribution: {},
            disclosureDistribution,
            contentHashCollisions: collisions,
            warnings: duplicateRate > 0.1 ? ["High duplicate rate detected"] : [],
        };
    }
}
