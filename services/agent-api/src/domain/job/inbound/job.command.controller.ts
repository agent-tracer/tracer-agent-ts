import { Body, Controller, Headers, HttpCode, HttpStatus, NotFoundException, Param, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { ClaimRuleJobUseCase } from "~agent-api/domain/job/application/command/claim.rule.job.usecase.js";
import { ReleaseRuleJobUseCase } from "~agent-api/domain/job/application/command/release.rule.job.usecase.js";
import { RenewRuleJobLeaseUseCase } from "~agent-api/domain/job/application/command/renew.rule.job.lease.usecase.js";
import { SettleRuleJobUseCase } from "~agent-api/domain/job/application/command/settle.rule.job.usecase.js";
import { JOB_STATUS, type JobStatus } from "~agent-api/domain/job/model/job.const.js";
import { JobLeaseHeldError, LeaseOwnerMissingError } from "~agent-api/domain/job/model/job.errors.js";
import { MONITOR_LEASE_OWNER_HEADER } from "~agent-api/domain/job/model/job.lease.const.js";
import { failureBodySchema, reportBodySchema, type FailureBody, type ReportBody } from "./job.lease.schema.js";
import { CancelJobUseCase } from "~agent-api/domain/job/application/command/cancel.job.usecase.js";
import { EnqueueJobUseCase } from "~agent-api/domain/job/application/command/enqueue.job.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import { enqueueBodySchema, type EnqueueBody } from "./job.command.schema.js";

/** 잡 접수와 취소의 HTTP 계약을 제공한다. */
@Controller("api/agent/jobs")
export class JobCommandController {
    constructor(
        private readonly enqueueJob: EnqueueJobUseCase,
        private readonly cancelJob: CancelJobUseCase,
        private readonly claimRuleJob: ClaimRuleJobUseCase,
        private readonly renewRuleJobLease: RenewRuleJobLeaseUseCase,
        private readonly settleRuleJob: SettleRuleJobUseCase,
        private readonly releaseRuleJob: ReleaseRuleJobUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    async enqueue(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(enqueueBodySchema)) body: EnqueueBody,
    ) {
        return this.enqueueJob.execute(
            resolveUserId(user),
            body.kind,
            body.input ?? {},
            body.idempotencyKey !== undefined ? { idempotencyKey: body.idempotencyKey } : {},
        );
    }

    @Post(":id/cancel")
    @HttpCode(HttpStatus.OK)
    async cancel(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        const job = await this.cancelJob.execute(resolveUserId(user), id, new Date());
        if (job === null) throw new NotFoundException("Job execution not found");
        return { job };
    }

    @Post(":id/start")
    @HttpCode(HttpStatus.OK)
    async claim(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Headers(MONITOR_LEASE_OWNER_HEADER) owner: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        const lease = await this.claimRuleJob.execute(resolveUserId(user), id, leaseOwnerOf(owner), new Date());
        if (lease === null) throw new NotFoundException("Job execution not found");
        if (!lease.held) throw new JobLeaseHeldError();
        return lease;
    }

    @Post(":id/lease")
    @HttpCode(HttpStatus.OK)
    async renewLease(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Headers(MONITOR_LEASE_OWNER_HEADER) owner: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        const lease = await this.renewRuleJobLease.execute(resolveUserId(user), id, leaseOwnerOf(owner), new Date());
        if (lease === null) throw new NotFoundException("Job execution not found");
        return lease;
    }

    @Post(":id/results")
    @HttpCode(HttpStatus.OK)
    async reportResult(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Headers(MONITOR_LEASE_OWNER_HEADER) owner: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(reportBodySchema)) body: ReportBody,
    ) {
        return this.settle(user, owner, id, { status: JOB_STATUS.completed, result: { ...body } });
    }

    @Post(":id/fail")
    @HttpCode(HttpStatus.OK)
    async fail(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Headers(MONITOR_LEASE_OWNER_HEADER) owner: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(failureBodySchema)) body: FailureBody,
    ) {
        return this.settle(user, owner, id, { status: JOB_STATUS.failed, error: body.message });
    }

    @Post(":id/release")
    @HttpCode(HttpStatus.OK)
    async release(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Headers(MONITOR_LEASE_OWNER_HEADER) owner: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        const released = await this.releaseRuleJob.execute(resolveUserId(user), id, leaseOwnerOf(owner), new Date());
        if (released === null) throw new NotFoundException("Job execution not found");
        return { released };
    }

    private async settle(
        user: string | undefined,
        owner: string | undefined,
        id: string,
        outcome: { status: JobStatus; result?: Record<string, unknown>; error?: string },
    ) {
        const settled = await this.settleRuleJob.execute(resolveUserId(user), id, leaseOwnerOf(owner), outcome, new Date());
        if (settled === "not-found") throw new NotFoundException("Job execution not found");
        if (settled === "lease-lost") throw new JobLeaseHeldError();
        return { settled: true };
    }
}

/** 리스는 쥔 실행기를 이름으로 구분하므로 이름이 없으면 요청 자체가 성립하지 않는다. */
function leaseOwnerOf(owner: string | undefined): string {
    const trimmed = owner?.trim() ?? "";
    if (trimmed.length === 0) throw new LeaseOwnerMissingError();
    return trimmed;
}
