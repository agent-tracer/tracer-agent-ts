import { z } from "zod";
import { CHAT_EXECUTION_PHASES, CHAT_LANGUAGE } from "~agent-api/domain/chat/model/chat.const.js";

export const createThreadSchema = z.object({
    title: z.string().trim().min(1).max(200),
});

export type CreateThreadPayload = z.infer<typeof createThreadSchema>;

export const renameThreadSchema = z.object({
    title: z.string().trim().min(1).max(200),
});

export type RenameThreadPayload = z.infer<typeof renameThreadSchema>;

export const postMessageSchema = z.object({
    clientRequestId: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(10_000),
    model: z.string().trim().min(1).optional(),
    language: z.enum([
        CHAT_LANGUAGE.auto,
        CHAT_LANGUAGE.ko,
        CHAT_LANGUAGE.en,
        CHAT_LANGUAGE.ja,
        CHAT_LANGUAGE.zh,
    ]).optional(),
});

export type PostMessagePayload = z.infer<typeof postMessageSchema>;

export const checkpointDraftSchema = z.object({
    token: z.string().trim().min(1).max(200),
    attempt: z.number().int().min(1),
    draftSeq: z.number().int().min(1),
    text: z.string().max(200_000),
    phase: z.enum(CHAT_EXECUTION_PHASES),
});

export type CheckpointDraftPayload = z.infer<typeof checkpointDraftSchema>;

export const proposeToolSchema = z.object({
    toolName: z.string().trim().min(1).max(100),
    args: z.record(z.unknown()).default({}),
});

export type ProposeToolPayload = z.infer<typeof proposeToolSchema>;

export const confirmToolSchema = z.object({
    decision: z.enum(["approve", "reject"]),
});

export type ConfirmToolPayload = z.infer<typeof confirmToolSchema>;
