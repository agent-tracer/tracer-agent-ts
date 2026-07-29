import { Inject, Injectable } from "@nestjs/common";
import { buildExperimentPreview } from "~agent-api/domain/evaluation/model/experiment.preview.model.js";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";

@Injectable()
export class PreviewExperimentUseCase {
    constructor(@Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort) {}
    async execute(userId: string, id: string) {
        const experiment = await this.repository.findExperiment(userId, id);
        if (experiment === null || experiment.status !== "draft") throw new Error("Draft experiment not found");
        return buildExperimentPreview(
            experiment,
            await this.repository.listExamples(userId, experiment.datasetId, experiment.datasetRevision),
            await this.repository.listVariants(userId, id),
        );
    }
}
