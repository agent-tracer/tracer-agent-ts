import type { AgentAxis } from "@tracer-agent/llm";
import type { JobExecutor, JobKind, JobStatus } from "~agent-api/domain/job/model/job.const.js";
import type { Job } from "~agent-api/domain/job/model/job.model.js";

/** 잡 하나의 와이어 표현이며 시각은 ISO 문자열이다. */
export interface JobDto {
    readonly id: string;
    readonly userId: string;
    readonly kind: JobKind;
    readonly executor: JobExecutor;
    readonly backend: AgentAxis;
    readonly status: JobStatus;
    readonly attempts: number;
    readonly taskId: string | null;
    readonly input: Record<string, unknown>;
    readonly result: Record<string, unknown>;
    readonly usage: Record<string, unknown>;
    readonly error: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly startedAt: string | null;
    readonly completedAt: string | null;
}

export interface JobListDto {
    readonly items: readonly JobDto[];
    readonly total: number;
}

export function mapJob(job: Job): JobDto {
    return {
        id: job.id,
        userId: job.userId,
        kind: job.kind,
        executor: job.executor,
        backend: job.backend,
        status: job.status,
        attempts: job.attempts,
        taskId: job.taskId,
        input: job.input,
        result: job.result,
        usage: job.usage,
        error: job.error,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        startedAt: job.startedAt !== null ? job.startedAt.toISOString() : null,
        completedAt: job.completedAt !== null ? job.completedAt.toISOString() : null,
    };
}
