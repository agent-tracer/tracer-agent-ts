import { Inject, Injectable } from "@nestjs/common";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";

@Injectable()
export class ListExperimentExecutionsUseCase {
    constructor(@Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort) {}
    async execute(userId: string, id: string) {
        if (await this.repository.findExperiment(userId, id) === null) throw new Error("Experiment not found");
        const executions = await this.repository.listExecutions(userId, id);
        const scores = await this.repository.listScores(userId, id);
        return {
            executions: executions.map((execution) => ({
                execution,
                scores: scores.filter((score) => score.executionId === execution.id),
            })),
        };
    }
}
