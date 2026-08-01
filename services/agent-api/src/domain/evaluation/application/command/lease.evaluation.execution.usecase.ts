import { Inject, Injectable } from "@nestjs/common";
import { ExperimentNotFoundError } from "~agent-api/domain/evaluation/model/evaluation.error.js";
import { toExecutionView } from "~agent-api/domain/evaluation/model/experiment.view.model.js";
import { EXPERIMENT_CLOCK, type ExperimentClockPort } from "~agent-api/domain/evaluation/port/experiment.support.port.js";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";

export interface LeaseEvaluationExecutionInput {
    readonly userId: string;
    readonly experimentId: string;
    readonly executionId?: string | undefined;
    readonly owner: string;
}

@Injectable()
export class LeaseEvaluationExecutionUseCase {
    constructor(
        @Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort,
        @Inject(EXPERIMENT_CLOCK) private readonly clock: ExperimentClockPort,
    ) {}

    async execute(input: LeaseEvaluationExecutionInput) {
        const experiment = await this.repository.findExperiment(input.userId, input.experimentId);
        if (experiment === null) throw new ExperimentNotFoundError(input.experimentId);

        const now = this.clock.now();
        const execution = await this.repository.leaseExecution(
            input.userId, input.experimentId, input.executionId ?? null, input.owner, now,
        );
        if (execution === null) return null;

        const context = await this.repository.loadExecutionContext(input.userId, execution);
        if (context === null) return null;

        const priorCostUsd = await this.repository.spentCostUsd(input.userId, input.experimentId);
        return {
            execution: toExecutionView(execution),
            variant: context.variant,
            example: context.example,
            prompt: context.prompt,
            evaluatorDefinitions: context.evaluatorDefinitions,
            // 남은 예산이 이번 시도가 쓸 수 있는 상한이며 워커가 이 값으로 소진을 판정한다.
            amount: Math.max(0, experiment.maxBudgetUsd - priorCostUsd),
            priorCostUsd,
        };
    }
}
