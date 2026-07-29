import { Inject, Injectable } from "@nestjs/common";
import { compareExperiment } from "~agent-api/domain/evaluation/model/experiment.comparison.model.js";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";

@Injectable()
export class GetExperimentComparisonUseCase {
    constructor(@Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort) {}
    async execute(userId: string, id: string) {
        if (await this.repository.findExperiment(userId, id) === null) throw new Error("Experiment not found");
        return compareExperiment(
            await this.repository.listVariants(userId, id),
            await this.repository.listExecutions(userId, id),
            await this.repository.listScores(userId, id),
        );
    }
}
