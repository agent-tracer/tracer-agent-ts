import { z } from "zod";
import { JOB_STEP_EVENT_KINDS, JOB_STEP_ROLES } from "~agent-api/domain/job/model/job.step.model.js";

/** 실행기가 잰 관측이며 칸의 이름은 워크플로 축이 원장에 적는 것과 같다. */
const usageSchema = z.object({
    model: z.string().nullable(),
    durationMs: z.number().int().nullable(),
    costUsd: z.number().nullable(),
    numTurns: z.number().int().nullable(),
    inputTokens: z.number().int().nullable().optional(),
    outputTokens: z.number().int().nullable().optional(),
    cacheReadTokens: z.number().int().nullable().optional(),
    cacheCreationTokens: z.number().int().nullable().optional(),
});

/** 실행기가 남긴 궤적 한 줄이며 시도 회차는 원장이 세므로 실행기가 싣지 않는다. */
const stepSchema = z.object({
    seq: z.number().int().min(0),
    role: z.enum(JOB_STEP_ROLES),
    content: z.string(),
    truncated: z.boolean(),
    toolCalls: z.array(z.object({
        id: z.string(),
        name: z.string(),
        args: z.record(z.string(), z.unknown()),
    })),
    toolName: z.string().optional(),
    toolCallId: z.string().optional(),
    inputTokens: z.number().int().optional(),
    outputTokens: z.number().int().optional(),
    cacheReadTokens: z.number().int().optional(),
    cacheCreationTokens: z.number().int().optional(),
    stopReason: z.string().optional(),
    nodeName: z.string().optional(),
    eventKind: z.enum(JOB_STEP_EVENT_KINDS).optional(),
    durationMs: z.number().int().optional(),
});

export const reportBodySchema = z.object({
    rules: z.array(z.record(z.string(), z.unknown())),
    skipped: z.array(z.string()).optional(),
    usage: usageSchema,
    steps: z.array(stepSchema),
});

export const failureBodySchema = z.object({
    message: z.string().trim().min(1),
    retryable: z.boolean().optional(),
    usage: usageSchema,
    steps: z.array(stepSchema),
});

export type ReportBody = z.infer<typeof reportBodySchema>;
export type FailureBody = z.infer<typeof failureBodySchema>;
export type ReportedUsage = z.infer<typeof usageSchema>;
export type ReportedStep = z.infer<typeof stepSchema>;
