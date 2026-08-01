import { AGENT_BACKEND, type AgentAxis } from "@tracer-agent/llm";
import { InvariantViolationError } from "@tracer-agent/platform";
import {
    isCancelableJobStatus,
    isTerminalJobStatus,
    JOB_EXECUTOR,
    JOB_STATUS,
    type JobExecutor,
    type JobKind,
    type JobStatus,
} from "~agent-api/domain/job/model/job.const.js";

const LOCAL_EXECUTOR: JobExecutor = "local";

export interface JobIdempotency {
    readonly key: string;
    readonly inputHash: string;
}

/** 에이전트 실행 요청 하나의 수명이며 접수부터 종결까지의 상태와 입력과 산출을 든다. */
export class Job {
    id!: string;

    userId!: string;

    kind!: JobKind;

    executor!: JobExecutor;

    /** 이 잡을 받은 접수구의 축이며 접수 본문이 싣는 값이 아니다. */
    backend!: AgentAxis;

    status!: JobStatus;

    attempts!: number;

    taskId!: string | null;

    idempotencyKey!: string | null;

    idempotencyInputHash!: string | null;

    input!: Record<string, unknown>;

    result!: Record<string, unknown>;

    usage!: Record<string, unknown>;

    error!: string | null;

    createdAt!: Date;

    updatedAt!: Date;

    startedAt!: Date | null;

    completedAt!: Date | null;

    /** 로컬 실행 잡의 리스 소유자이며, 리스를 쥔 실행기만 결과와 실패를 제출할 수 있다. */
    leaseOwner!: string | null;

    leaseExpiresAt!: Date | null;

    static create(
        id: string,
        userId: string,
        kind: JobKind,
        input: Record<string, unknown>,
        now: Date,
        idempotency?: JobIdempotency,
    ): Job {
        const job = new Job();
        job.id = id;
        job.userId = userId;
        job.kind = kind;
        job.executor = JOB_EXECUTOR[kind];
        job.backend = AGENT_BACKEND;
        job.status = JOB_STATUS.pending;
        job.attempts = 0;
        job.taskId = extractTaskId(input);
        job.idempotencyKey = idempotency?.key ?? null;
        job.idempotencyInputHash = idempotency?.inputHash ?? null;
        job.input = input;
        job.result = {};
        job.usage = {};
        job.error = null;
        job.createdAt = now;
        job.updatedAt = now;
        job.startedAt = null;
        job.completedAt = null;
        job.leaseOwner = null;
        job.leaseExpiresAt = null;
        return job;
    }

    cancel(now: Date): void {
        if (!this.isCancelable()) throw new InvariantViolationError("job.not-cancelable");
        this.status = JOB_STATUS.canceled;
        this.completedAt = now;
        this.updatedAt = now;
    }

    isTerminal(): boolean {
        return isTerminalJobStatus(this.status);
    }

    isCancelable(): boolean {
        return isCancelableJobStatus(this.status);
    }

    runsLocally(): boolean {
        return this.executor === LOCAL_EXECUTOR;
    }

    isOwnedBy(userId: string): boolean {
        return this.userId === userId;
    }
}

// 태스크에 매인 잡은 input에 실린 taskId를 컬럼으로 승격해 저장소가 이 태스크의 최신 잡을 직접 조회한다.
function extractTaskId(input: Record<string, unknown>): string | null {
    const raw = input["taskId"];
    return typeof raw === "string" && raw.length > 0 ? raw : null;
}
