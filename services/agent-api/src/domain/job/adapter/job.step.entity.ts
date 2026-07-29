import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type {
    JobStep,
    JobStepEventKind,
    JobStepRole,
    JobStepToolCall,
} from "~agent-api/domain/job/model/job.step.model.js";

/** 잡이 부른 모델과 도구의 궤적을 담는 PostgreSQL 저장 스키마다. */
@Entity({ name: "ai_job_steps" })
@Index("ai_job_steps_job_attempt_seq", ["jobId", "attempt", "seq"], { unique: true })
@Index("ai_job_steps_user_created", ["userId", "createdAt"])
export class JobStepEntity {
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
    eventKind!: JobStepEventKind | null;

    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}

export function toJobStep(row: JobStepEntity): JobStep {
    return {
        id: row.id,
        jobId: row.jobId,
        userId: row.userId,
        attempt: row.attempt,
        seq: row.seq,
        role: row.role,
        content: row.content,
        truncated: row.truncated,
        toolCalls: row.toolCalls,
        toolName: row.toolName,
        toolCallId: row.toolCallId,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        cacheReadTokens: row.cacheReadTokens,
        cacheCreationTokens: row.cacheCreationTokens,
        stopReason: row.stopReason,
        nodeName: row.nodeName,
        eventKind: row.eventKind,
        durationMs: row.durationMs,
        createdAt: row.createdAt,
    };
}
