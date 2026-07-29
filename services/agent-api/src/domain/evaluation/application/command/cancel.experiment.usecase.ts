import { Inject, Injectable } from "@nestjs/common";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";
import {
    EXPERIMENT_CLOCK, EXPERIMENT_DISPATCHER, type ExperimentClockPort, type ExperimentDispatcherPort,
} from "~agent-api/domain/evaluation/port/experiment.support.port.js";

@Injectable()
export class CancelExperimentUseCase {
    constructor(
        @Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort,
        @Inject(EXPERIMENT_DISPATCHER) private readonly dispatcher: ExperimentDispatcherPort,
        @Inject(EXPERIMENT_CLOCK) private readonly clock: ExperimentClockPort,
    ) {}
    async execute(userId: string, id: string) {
        const experiment = await this.repository.findExperiment(userId, id);
        if (experiment === null) throw new Error("Experiment not found");
        if (["completed", "failed", "cancelled"].includes(experiment.status)) throw new Error("Terminal experiment cannot be cancelled");
        const outcome = experiment.status === "running" ? await this.dispatcher.cancel(id) : "absent";
        experiment.status = "cancelled";
        experiment.completedAt = this.clock.now();
        await this.repository.saveExperiment(experiment, await this.repository.listVariants(userId, id));
        return { experiment, workflowCancellation: outcome };
    }
}
