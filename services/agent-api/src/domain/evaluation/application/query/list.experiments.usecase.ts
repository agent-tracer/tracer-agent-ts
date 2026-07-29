import { Inject, Injectable } from "@nestjs/common";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";

@Injectable()
export class ListExperimentsUseCase {
    constructor(@Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort) {}
    execute(userId: string) {
        return this.repository.listExperiments(userId);
    }
}
