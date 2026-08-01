import { Inject, Injectable } from "@nestjs/common";
import { ExperimentNotFoundError } from "~agent-api/domain/evaluation/model/evaluation.error.js";
import { toExecutionView } from "~agent-api/domain/evaluation/model/experiment.view.model.js";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";

@Injectable()
export class ListExperimentExecutionsUseCase {
    constructor(@Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort) {}
    async execute(userId: string, id: string) {
        if (await this.repository.findExperiment(userId, id) === null) throw new ExperimentNotFoundError(id);
        const executions = await this.repository.listExecutions(userId, id);
        const scores = await this.repository.listScores(userId, id);
        return {
            executions: executions.map((execution) => ({
                execution: toExecutionView(execution),
                scores: scores.filter((score) => score.executionId === execution.id),
            })),
        };
    }
}
