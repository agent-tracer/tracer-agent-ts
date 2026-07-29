import { JOB_EXECUTOR, JOB_STATUS, type JobKind, type JobStatus } from "~agent-api/domain/job/model/job.const.js";

/** 자기 접수구에서 원장을 직접 쓰는 구현체가 남긴 잡 실행 한 건이다. */
export class GraphJobExecution {
    id!: string;

    userId!: string;

    /** 이 원장은 잡 종류를 에이전트 이름으로 적어 하이픈 표기를 쓴다. */
    kind!: string;

    idempotencyKey!: string | null;

    taskId!: string | null;

    status!: string;

    budgetUsd!: number;

    costUsd!: number | null;

    result!: Record<string, unknown> | null;

    error!: string | null;

    createdAt!: Date;

    updatedAt!: Date;

    startedAt!: Date | null;

    completedAt!: Date | null;

    isOwnedBy(userId: string): boolean {
        return this.userId === userId;
    }
}

/** 잡 종류를 에이전트 이름으로 적는 원장과 점 표기를 쓰는 접수 표면의 대응이며, 접수 라우트를 가진 셋만 값을 갖는다. */
export const AGENT_ID_BY_JOB_KIND: Partial<Record<JobKind, string>> = {
    "recipe.scan": "recipe-scan",
    "task.cleanup": "task-cleanup",
    "title.suggestion": "title-suggestion",
};

export const JOB_KIND_BY_AGENT_ID: Record<string, JobKind> = {
    "recipe-scan": "recipe.scan",
    "task-cleanup": "task.cleanup",
    "title-suggestion": "title.suggestion",
};

// 이 원장은 접수 즉시를 queued로 표현하고 ai_jobs는 pending으로 표현해 어휘가 갈린다.
const GRAPH_STATUS_BY_JOB_STATUS: Record<JobStatus, string> = {
    [JOB_STATUS.pending]: "queued",
    [JOB_STATUS.running]: "running",
    [JOB_STATUS.completed]: "completed",
    [JOB_STATUS.failed]: "failed",
    [JOB_STATUS.canceled]: "canceled",
};

const JOB_STATUS_BY_GRAPH_STATUS: Record<string, JobStatus> = Object.fromEntries(
    Object.entries(GRAPH_STATUS_BY_JOB_STATUS).map(([status, graphStatus]) => [graphStatus, status as JobStatus]),
);

export function toGraphStatus(status: JobStatus): string {
    return GRAPH_STATUS_BY_JOB_STATUS[status];
}

export function fromGraphStatus(status: string): JobStatus {
    return JOB_STATUS_BY_GRAPH_STATUS[status] ?? JOB_STATUS.failed;
}

export function graphJobExecutor(kind: JobKind): typeof JOB_EXECUTOR[JobKind] {
    return JOB_EXECUTOR[kind];
}
