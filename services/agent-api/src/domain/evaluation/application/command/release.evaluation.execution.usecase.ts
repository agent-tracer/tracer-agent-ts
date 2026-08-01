import { Inject, Injectable } from "@nestjs/common";
import { released } from "~agent-api/domain/evaluation/model/evaluation.execution.policy.js";
import { ExecutionNotFoundError } from "~agent-api/domain/evaluation/model/evaluation.error.js";
import type { ExecutionStatus } from "~agent-api/domain/evaluation/model/experiment.model.js";
import { EXPERIMENT_CLOCK, type ExperimentClockPort } from "~agent-api/domain/evaluation/port/experiment.support.port.js";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";

export interface ReleaseEvaluationExecutionInput {
    readonly userId: string;
    readonly executionId: string;
    readonly attempt: number;
    readonly terminal: boolean;
    readonly failureReason?: string | undefined;
}

@Injectable()
export class ReleaseEvaluationExecutionUseCase {
    constructor(
        @Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort,
        @Inject(EXPERIMENT_CLOCK) private readonly clock: ExperimentClockPort,
    ) {}

    async execute(input: ReleaseEvaluationExecutionInput): Promise<{ readonly status: ExecutionStatus }> {
        const execution = await this.repository.findExecution(input.userId, input.executionId);
        if (execution === null) throw new ExecutionNotFoundError(input.executionId);

        // 정산이 먼저 닿아 이미 닫힌 실행에는 그 상태를 그대로 낸다.
        if (execution.status !== "running") return { status: execution.status };

        const next = released(execution, input.terminal, input.failureReason ?? null, this.clock.now());
        await this.repository.saveExecution(next);
        return { status: next.status };
    }
}
