import { Inject, Injectable } from "@nestjs/common";
import { finalStatus } from "~agent-api/domain/evaluation/model/evaluation.execution.policy.js";
import { ExperimentNotFoundError } from "~agent-api/domain/evaluation/model/evaluation.error.js";
import type { ExperimentStatus } from "~agent-api/domain/evaluation/model/experiment.model.js";
import { EXPERIMENT_CLOCK, type ExperimentClockPort } from "~agent-api/domain/evaluation/port/experiment.support.port.js";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";

export interface FinalizeEvaluationExperimentInput {
    readonly userId: string;
    readonly experimentId: string;
    readonly cancelled: boolean;
    readonly failed: boolean;
    readonly budgetExhausted: boolean;
}

@Injectable()
export class FinalizeEvaluationExperimentUseCase {
    constructor(
        @Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort,
        @Inject(EXPERIMENT_CLOCK) private readonly clock: ExperimentClockPort,
    ) {}

    async execute(input: FinalizeEvaluationExperimentInput): Promise<{ readonly status: ExperimentStatus }> {
        const status = await this.repository.finalizeExperiment(
            input.userId, input.experimentId, finalStatus(input), this.clock.now(),
        );
        if (status === null) throw new ExperimentNotFoundError(input.experimentId);
        return { status };
    }
}
