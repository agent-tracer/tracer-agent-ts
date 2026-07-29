import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { GraphJobExecution } from "~agent-api/domain/job/model/graph.job.execution.model.js";

/** 자기 접수구에서 원장을 직접 쓰는 구현체의 실행 표이며, 이 서비스는 읽기만 한다. */
@Entity({ name: "graph_job_executions" })
@Index("graph_job_executions_kind_status", ["kind", "status"])
@Index("graph_job_executions_idempotency", ["kind", "idempotencyKey"], {
    unique: true,
    where: "\"idempotency_key\" IS NOT NULL",
})
@Index("graph_job_executions_user_kind_task", ["userId", "kind", "taskId"])
export class GraphJobExecutionEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    kind!: string;

    @Column({ name: "idempotency_key", type: "text", nullable: true })
    idempotencyKey!: string | null;

    // 태스크에 매인 잡 종류만 값을 갖고, 사용자 전체를 훑는 종류는 비어 있다.
    @Column({ name: "task_id", type: "text", nullable: true })
    taskId!: string | null;

    @Column({ type: "text" })
    status!: string;

    @Column({ name: "budget_usd", type: "double precision" })
    budgetUsd!: number;

    @Column({ name: "cost_usd", type: "double precision", nullable: true })
    costUsd!: number | null;

    @Column({ type: "jsonb", nullable: true })
    result!: Record<string, unknown> | null;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null;

    @Column({ name: "completed_at", type: "timestamptz", nullable: true })
    completedAt!: Date | null;
}

export function toGraphJobExecution(row: GraphJobExecutionEntity): GraphJobExecution {
    const execution = new GraphJobExecution();
    execution.id = row.id;
    execution.userId = row.userId;
    execution.kind = row.kind;
    execution.idempotencyKey = row.idempotencyKey;
    execution.taskId = row.taskId;
    execution.status = row.status;
    execution.budgetUsd = row.budgetUsd;
    execution.costUsd = row.costUsd;
    execution.result = row.result;
    execution.error = row.error;
    execution.createdAt = row.createdAt;
    execution.updatedAt = row.updatedAt;
    execution.startedAt = row.startedAt;
    execution.completedAt = row.completedAt;
    return execution;
}
