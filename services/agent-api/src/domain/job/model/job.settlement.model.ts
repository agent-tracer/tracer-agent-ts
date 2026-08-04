import type { JobStatus } from "~agent-api/domain/job/model/job.const.js";
import type { JobStepEventKind, JobStepRole, JobStepToolCall } from "~agent-api/domain/job/model/job.step.model.js";

/** 실행기가 잰 관측이며 칸의 이름은 워크플로 축이 원장에 적는 것과 같다. */
export interface JobExecutionObservation {
    readonly model: string | null;
    readonly durationMs: number | null;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly inputTokens?: number | null | undefined;
    readonly outputTokens?: number | null | undefined;
    readonly cacheReadTokens?: number | null | undefined;
    readonly cacheCreationTokens?: number | null | undefined;
}

/** 실행기가 남긴 궤적 한 줄이며 시도 회차는 원장이 세므로 실행기가 싣지 않는다. */
export interface JobExecutionStep {
    readonly seq: number;
    readonly role: JobStepRole;
    readonly content: string;
    readonly truncated: boolean;
    readonly toolCalls: readonly JobStepToolCall[];
    readonly toolName?: string | undefined;
    readonly toolCallId?: string | undefined;
    readonly inputTokens?: number | undefined;
    readonly outputTokens?: number | undefined;
    readonly cacheReadTokens?: number | undefined;
    readonly cacheCreationTokens?: number | undefined;
    readonly stopReason?: string | undefined;
    readonly nodeName?: string | undefined;
    readonly eventKind?: JobStepEventKind | undefined;
    readonly durationMs?: number | undefined;
}

/** 리스를 쥔 실행기가 잡을 종결하며 싣는 산출과 관측과 궤적이다. */
export interface JobSettlement {
    readonly status: JobStatus;
    readonly result?: Record<string, unknown>;
    readonly error?: string;
    /** 원장의 usage 자리에 그대로 실린다. */
    readonly usage: JobExecutionObservation;
    /** 그 잡의 시도 회차로 단계 원장에 실린다. */
    readonly steps: readonly JobExecutionStep[];
}
