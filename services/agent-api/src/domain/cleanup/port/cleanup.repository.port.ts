import type { CleanupSuggestionStatus } from "~agent-api/domain/cleanup/model/cleanup.const.js";
import type { CleanupSuggestion } from "~agent-api/domain/cleanup/model/cleanup.suggestion.model.js";

export const CLEANUP_SUGGESTION_REPOSITORY = Symbol("CleanupSuggestionRepository");

/** 정리 제안 원장의 조회와 저장을 제공하는 포트다. */
export interface CleanupSuggestionRepositoryPort {
    findById(id: string): Promise<CleanupSuggestion | null>;
    findByUserStatus(userId: string, status: CleanupSuggestionStatus): Promise<CleanupSuggestion[]>;
    upsert(suggestion: CleanupSuggestion): Promise<void>;
}
