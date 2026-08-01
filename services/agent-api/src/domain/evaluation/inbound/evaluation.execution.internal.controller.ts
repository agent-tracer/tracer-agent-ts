import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { FinalizeEvaluationExperimentUseCase } from "~agent-api/domain/evaluation/application/command/finalize.evaluation.experiment.usecase.js";
import { LeaseEvaluationExecutionUseCase } from "~agent-api/domain/evaluation/application/command/lease.evaluation.execution.usecase.js";
import { ReleaseEvaluationExecutionUseCase } from "~agent-api/domain/evaluation/application/command/release.evaluation.execution.usecase.js";
import { SettleEvaluationExecutionUseCase } from "~agent-api/domain/evaluation/application/command/settle.evaluation.execution.usecase.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import {
    finalizeEvaluationExperimentSchema,
    leaseEvaluationExecutionSchema,
    releaseEvaluationExecutionSchema,
    settleEvaluationExecutionSchema,
    type FinalizeEvaluationExperimentPayload,
    type LeaseEvaluationExecutionPayload,
    type ReleaseEvaluationExecutionPayload,
    type SettleEvaluationExecutionPayload,
} from "./evaluation.execution.schema.js";

/** 배포 단위 사이에서만 오가는 창구라 게이트웨이가 바깥에 열지 않으며, 브라우저는 이 경로를 알지 못한다. */
@Controller("internal/evaluation")
export class EvaluationExecutionInternalController {
    constructor(
        private readonly lease: LeaseEvaluationExecutionUseCase,
        private readonly settle: SettleEvaluationExecutionUseCase,
        private readonly release: ReleaseEvaluationExecutionUseCase,
        private readonly finalize: FinalizeEvaluationExperimentUseCase,
    ) {}

    @Post("executions/lease")
    @HttpCode(HttpStatus.OK)
    leaseExecution(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(leaseEvaluationExecutionSchema)) body: LeaseEvaluationExecutionPayload,
    ) {
        // 워커를 가리는 이름이 자기신고 사용자와 같은 값이라 lease 소유자도 그것으로 적는다.
        const userId = resolveUserId(user);
        return this.lease.execute({ ...body, userId, owner: userId });
    }

    @Post("executions/settle")
    @HttpCode(HttpStatus.OK)
    settleExecution(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(settleEvaluationExecutionSchema)) body: SettleEvaluationExecutionPayload,
    ) {
        return this.settle.execute({
            userId: resolveUserId(user),
            executionId: body.executionId,
            attempt: body.attempt,
            jobId: body.jobId,
            output: body.output ?? null,
            durationMs: body.durationMs,
            traceId: body.traceId ?? null,
            costUsd: body.costUsd,
            resolvedPromptHash: body.resolvedPromptHash ?? null,
            scores: body.scores,
        });
    }

    @Post("executions/release")
    @HttpCode(HttpStatus.OK)
    releaseExecution(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(releaseEvaluationExecutionSchema)) body: ReleaseEvaluationExecutionPayload,
    ) {
        return this.release.execute({ ...body, userId: resolveUserId(user) });
    }

    @Post("experiments/finalize")
    @HttpCode(HttpStatus.OK)
    finalizeExperiment(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(finalizeEvaluationExperimentSchema)) body: FinalizeEvaluationExperimentPayload,
    ) {
        return this.finalize.execute({ ...body, userId: resolveUserId(user) });
    }
}
