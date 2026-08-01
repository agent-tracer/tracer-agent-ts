import { z } from "zod";
import {
    CLEANUP_MAX_EVIDENCE_EVENT_IDS,
    CLEANUP_MAX_SUGGESTIONS,
} from "./cleanup.tool.schema.js";

const cleanupSuggestionSchema = z.object({
    kind: z.literal("archive"),
    taskId: z.string().trim().min(1),
    rationale: z.string().trim().min(1).max(500),
    evidenceEventIds: z.array(z.string().trim().min(1)).max(CLEANUP_MAX_EVIDENCE_EVENT_IDS),
});

/** 어느 구현체로 실행하든 스캔 한 번이 돌려주는 구조화 출력이며 모양은 계약이 소유한다. */
export const cleanupSuggestionsListSchema = z.object({
    suggestions: z.array(cleanupSuggestionSchema).max(CLEANUP_MAX_SUGGESTIONS).default([]),
});

export type CleanupSuggestionPayload = z.infer<typeof cleanupSuggestionSchema>;
export type CleanupSuggestionsList = z.infer<typeof cleanupSuggestionsListSchema>;
