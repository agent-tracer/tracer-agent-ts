import { Inject, Injectable } from "@nestjs/common";
import { settled } from "~agent-api/domain/evaluation/model/evaluation.execution.policy.js";
import { ExecutionAttemptMismatchError, ExecutionNotFoundError } from "~agent-api/domain/evaluation/model/evaluation.error.js";
import type { EvaluationScore } from "~agent-api/domain/evaluation/model/experiment.model.js";
import { EXPERIMENT_CLOCK, EXPERIMENT_ID_GENERATOR, type ExperimentClockPort, type ExperimentIdGeneratorPort } from "~agent-api/domain/evaluation/port/experiment.support.port.js";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";

export interface SettleEvaluationExecutionInput {
    readonly userId: string;
    readonly executionId: string;
    readonly attempt: number;
    readonly jobId: string;
    readonly output: Record<string, unknown> | null;
    readonly durationMs: number;
    readonly traceId: string | null;
    readonly costUsd: number;
    readonly resolvedPromptHash: string | null;
    readonly scores: readonly {
        readonly evaluatorId: string;
        readonly evaluatorVersion: string;
        readonly score: number;
        readonly label?: string | null | undefined;
        readonly reason?: string | null | undefined;
        readonly judgeCostUsd?: number | undefined;
    }[];
}

@Injectable()
export class SettleEvaluationExecutionUseCase {
    constructor(
        @Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort,
        @Inject(EXPERIMENT_CLOCK) private readonly clock: ExperimentClockPort,
        @Inject(EXPERIMENT_ID_GENERATOR) private readonly ids: ExperimentIdGeneratorPort,
    ) {}

    async execute(input: SettleEvaluationExecutionInput): Promise<{ readonly settled: boolean }> {
        const execution = await this.repository.findExecution(input.userId, input.executionId);
        if (execution === null) throw new ExecutionNotFoundError(input.executionId);
        if (input.attempt > execution.attemptCount) {
            throw new ExecutionAttemptMismatchError(input.executionId, input.attempt, execution.attemptCount);
        }

        const now = this.clock.now();
        const recorded = await this.repository.recordSettlement({
            executionId: input.executionId,
            attempt: input.attempt,
            jobId: input.jobId,
            traceId: input.traceId,
            resolvedPromptHash: input.resolvedPromptHash,
            durationMs: input.durationMs,
            costUsd: input.costUsd,
            settledAt: now,
        });
        // 같은 시도가 다시 오면 원장이 이미 승자를 정했으므로 점수도 비용도 다시 적지 않는다.
        if (!recorded) return { settled: false };

        await this.repository.saveExecution(settled(execution, { ...input }, now));
        await this.repository.saveScores(input.scores.map((score): EvaluationScore => ({
            id: this.ids.next("score"),
            executionId: input.executionId,
            evaluatorId: score.evaluatorId,
            evaluatorVersion: score.evaluatorVersion,
            score: score.score,
            label: score.label ?? null,
            reason: score.reason ?? null,
            judgeCostUsd: score.judgeCostUsd ?? 0,
            createdAt: now,
        })));
        return { settled: true };
    }
}
