import { GraphJobExecution } from "~agent-api/domain/job/model/graph.job.execution.model.js";

export interface GraphJobExecutionSeed {
    readonly id: string;
    readonly userId: string;
    readonly kind: string;
    readonly status: string;
    readonly createdAt: Date;
    readonly taskId?: string | null;
    readonly result?: Record<string, unknown> | null;
    readonly error?: string | null;
}

/** 실행 원장 한 행의 대역이며 조회가 보지 않는 자리는 기본값으로 채운다. */
export function graphJobExecution(seed: GraphJobExecutionSeed): GraphJobExecution {
    const row = new GraphJobExecution();
    row.id = seed.id;
    row.userId = seed.userId;
    row.kind = seed.kind;
    row.idempotencyKey = null;
    row.taskId = seed.taskId ?? null;
    row.status = seed.status;
    row.budgetUsd = 2;
    row.costUsd = null;
    row.result = seed.result ?? null;
    row.error = seed.error ?? null;
    row.createdAt = seed.createdAt;
    row.updatedAt = seed.createdAt;
    row.startedAt = null;
    row.completedAt = null;
    return row;
}
