import { Inject, Injectable } from "@nestjs/common";
import { toExperimentView } from "~agent-api/domain/evaluation/model/experiment.view.model.js";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";

@Injectable()
export class ListExperimentsUseCase {
    constructor(@Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort) {}
    async execute(userId: string) {
        return { experiments: (await this.repository.listExperiments(userId)).map(toExperimentView) };
    }
}
