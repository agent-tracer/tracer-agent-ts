import type { AgentRunObservation } from "@tracer-agent/llm";
import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/** 실행 시도를 같은 기준으로 비교하는 관측 원장의 저장 스키마다. */
@Entity({ name: "agent_run_observations" })
@Index("agent_run_observations_user_created", ["userId", "createdAt"])
@Index("agent_run_observations_job", ["jobId"])
export class AgentRunObservationEntity {
    @PrimaryColumn({ name: "execution_id", type: "text" })
    executionId!: string;

    @PrimaryColumn({ name: "attempt_id", type: "text" })
    attemptId!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "job_id", type: "text", nullable: true })
    jobId!: string | null;

    @Column({ name: "agent_name", type: "text" })
    agentName!: string;

    @Column({ type: "text" })
    backend!: string;

    @Column({ name: "model_requested", type: "text" })
    modelRequested!: string;

    @Column({ name: "model_actual", type: "text", nullable: true })
    modelActual!: string | null;

    @Column({ name: "prompt_version", type: "text" })
    promptVersion!: string;

    @Column({ name: "tool_contract_version", type: "text" })
    toolContractVersion!: string;

    @Column({ type: "text" })
    status!: string;

    @Column({ name: "duration_ms", type: "integer" })
    durationMs!: number;

    @Column({ type: "jsonb" })
    usage!: Record<string, unknown>;

    @Column({ name: "cost_usd", type: "double precision", nullable: true })
    costUsd!: number | null;

    @Column({ type: "boolean" })
    landed!: boolean;

    @Column({ name: "repair_attempted", type: "boolean" })
    repairAttempted!: boolean;

    @Column({ type: "jsonb" })
    validation!: Record<string, unknown>;

    @Column({ name: "model_calls", type: "jsonb" })
    modelCalls!: unknown[];

    @Column({ name: "tool_calls", type: "jsonb" })
    toolCalls!: unknown[];

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}

export function toAgentRunObservationRow(
    userId: string,
    observation: AgentRunObservation,
    now: Date,
): AgentRunObservationEntity {
    const row = new AgentRunObservationEntity();
    row.executionId = observation.executionId;
    row.attemptId = observation.attemptId;
    row.userId = userId;
    row.jobId = observation.jobId;
    row.agentName = observation.agentName;
    row.backend = observation.backend;
    row.modelRequested = observation.modelRequested;
    row.modelActual = observation.modelActual;
    row.promptVersion = observation.promptVersion;
    row.toolContractVersion = observation.toolContractVersion;
    row.status = observation.status;
    row.durationMs = observation.durationMs;
    row.usage = { ...observation.usage };
    row.costUsd = observation.costUsd;
    row.landed = observation.landed;
    row.repairAttempted = observation.repairAttempted;
    row.validation = { ...observation.validation };
    row.modelCalls = [...observation.modelCalls];
    row.toolCalls = [...observation.toolCalls];
    row.createdAt = now;
    return row;
}
