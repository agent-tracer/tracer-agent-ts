import { Inject, Injectable } from "@nestjs/common";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";

@Injectable()
export class ListReviewsUseCase {
    constructor(@Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort) {}
    async execute(userId: string, experimentId: string) {
        if (await this.repository.findExperiment(userId, experimentId) === null) throw new Error("Experiment not found");
        return { reviews: await this.repository.listReviews(userId, experimentId) };
    }
}
