import type { JobStepOrchestrationEventKind, JobStepPayload, JobStepRole, JobStepToolCall } from "@tracer-agent/llm";
import { jobStepCarriesContent } from "@tracer-agent/llm";
import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export interface AiJobStepCreateInput {
    /** 생성 활동이 확정한 식별자이며 종결이 재시도돼도 같은 값으로 다시 쓴다. */
    readonly id: string;
    readonly jobId: string;
    readonly userId: string;
    /** 활동 재시도 회차이며 시도마다 seq가 0부터 다시 시작해도 이 값으로 분리된다. */
    readonly attempt: number;
    readonly step: JobStepPayload;
    readonly now: Date;
}

/** 도구 순환이 있는 잡의 궤적을 잡당 순서 있는 행으로 남기며 실패한 시도도 함께 남는다. */
@Entity({ name: "ai_job_steps" })
@Index("ai_job_steps_job_attempt_seq", ["jobId", "attempt", "seq"], { unique: true })
@Index("ai_job_steps_user_created", ["userId", "createdAt"])
export class AiJobStepEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "job_id", type: "text" })
    jobId!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "integer", default: 1 })
    attempt!: number;

    @Column({ type: "integer" })
    seq!: number;

    @Column({ type: "text" })
    role!: JobStepRole;

    @Column({ type: "text" })
    content!: string;

    @Column({ type: "boolean", default: false })
    truncated!: boolean;

    @Column({ name: "tool_calls", type: "jsonb", nullable: true })
    toolCalls!: JobStepToolCall[] | null;

    @Column({ name: "tool_name", type: "text", nullable: true })
    toolName!: string | null;

    @Column({ name: "tool_call_id", type: "text", nullable: true })
    toolCallId!: string | null;

    @Column({ name: "input_tokens", type: "integer", nullable: true })
    inputTokens!: number | null;

    @Column({ name: "output_tokens", type: "integer", nullable: true })
    outputTokens!: number | null;

    @Column({ name: "cache_read_tokens", type: "integer", nullable: true })
    cacheReadTokens!: number | null;

    @Column({ name: "cache_creation_tokens", type: "integer", nullable: true })
    cacheCreationTokens!: number | null;

    @Column({ name: "stop_reason", type: "text", nullable: true })
    stopReason!: string | null;

    @Column({ name: "node_name", type: "text", nullable: true })
    nodeName!: string | null;

    @Column({ name: "event_kind", type: "text", nullable: true })
    eventKind!: JobStepOrchestrationEventKind | null;

    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    static create(input: AiJobStepCreateInput): AiJobStepEntity {
        if (input.id.trim().length === 0) throw new Error("ai-job-step.empty-id");
        if (input.jobId.trim().length === 0) throw new Error("ai-job-step.empty-job");
        if (input.userId.trim().length === 0) throw new Error("ai-job-step.empty-user");
        if (input.step.seq < 0) throw new Error("ai-job-step.negative-seq");
        if (!jobStepCarriesContent(input.step)) throw new Error("ai-job-step.empty-content");

        const { step } = input;
        const row = new AiJobStepEntity();
        row.id = input.id;
        row.jobId = input.jobId;
        row.userId = input.userId;
        row.attempt = input.attempt;
        row.seq = step.seq;
        row.role = step.role;
        row.content = step.content;
        row.truncated = step.truncated;
        row.toolCalls = step.toolCalls.length > 0 ? [...step.toolCalls] : null;
        row.toolName = step.toolName ?? null;
        row.toolCallId = step.toolCallId ?? null;
        row.inputTokens = step.inputTokens ?? null;
        row.outputTokens = step.outputTokens ?? null;
        row.cacheReadTokens = step.cacheReadTokens ?? null;
        row.cacheCreationTokens = step.cacheCreationTokens ?? null;
        row.stopReason = step.stopReason ?? null;
        row.nodeName = step.nodeName ?? null;
        row.eventKind = step.eventKind ?? null;
        row.durationMs = step.durationMs ?? null;
        row.createdAt = input.now;
        return row;
    }
}
