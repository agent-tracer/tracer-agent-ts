import { Inject, Injectable } from "@nestjs/common";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";

@Injectable()
export class GetExperimentUseCase {
    constructor(@Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort) {}
    async execute(userId: string, id: string) {
        const experiment = await this.repository.findExperiment(userId, id);
        if (experiment === null) throw new Error("Experiment not found");
        return { experiment, variants: await this.repository.listVariants(userId, id) };
    }
}
