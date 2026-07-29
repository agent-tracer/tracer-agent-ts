import {
    fromGraphStatus,
    graphJobExecutor,
    JOB_KIND_BY_AGENT_ID,
    type GraphJobExecution,
} from "~agent-api/domain/job/model/graph.job.execution.model.js";
import type { JobDto } from "~agent-api/domain/job/model/job.view.model.js";

/** 자기 접수구에서 원장을 직접 쓰는 구현체의 실행 한 행을 그대로 비추는 와이어 표현이다. */
export interface GraphJobExecutionDto {
    readonly id: string;
    readonly userId: string;
    readonly kind: string;
    readonly status: string;
    readonly budgetUsd: number;
    readonly costUsd: number | null;
    readonly error: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly startedAt: string | null;
    readonly completedAt: string | null;
}

export function mapGraphJobExecution(row: GraphJobExecution): GraphJobExecutionDto {
    return {
        id: row.id,
        userId: row.userId,
        kind: row.kind,
        status: row.status,
        budgetUsd: row.budgetUsd,
        costUsd: row.costUsd,
        error: row.error,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        startedAt: row.startedAt !== null ? row.startedAt.toISOString() : null,
        completedAt: row.completedAt !== null ? row.completedAt.toISOString() : null,
    };
}

/** 두 원장을 한 화면이 같은 필드로 읽도록 실행 행을 잡 조회의 공통 모양으로 옮긴다. */
export function mapGraphJobExecutionToJobDto(row: GraphJobExecution): JobDto | null {
    const kind = JOB_KIND_BY_AGENT_ID[row.kind];
    if (kind === undefined) return null;
    return {
        id: row.id,
        userId: row.userId,
        kind,
        executor: graphJobExecutor(kind),
        status: fromGraphStatus(row.status),
        attempts: 1,
        taskId: row.taskId,
        input: row.taskId !== null ? { taskId: row.taskId } : {},
        result: row.result ?? {},
        usage: {},
        error: row.error,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        startedAt: row.startedAt !== null ? row.startedAt.toISOString() : null,
        completedAt: row.completedAt !== null ? row.completedAt.toISOString() : null,
    };
}
