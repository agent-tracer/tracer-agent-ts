import type {
    CleanupSuggestionKind,
    CleanupSuggestionStatus,
} from "~agent-api/domain/cleanup/model/cleanup.const.js";
import type { CleanupSuggestion } from "~agent-api/domain/cleanup/model/cleanup.suggestion.model.js";

/** 조회와 해소가 모두 내는 정리 제안 한 건의 칸이며 관측 시각은 싣지 않는다. */
export interface CleanupSuggestionDto {
    readonly id: string;
    readonly userId: string;
    readonly jobId: string;
    readonly taskId: string;
    readonly kind: CleanupSuggestionKind;
    readonly currentValue: string | null;
    readonly proposedValue: string | null;
    readonly rationale: string;
    readonly status: CleanupSuggestionStatus;
    readonly error: string | null;
    readonly createdAt: string;
    readonly resolvedAt: string | null;
}

export function mapCleanupSuggestion(suggestion: CleanupSuggestion): CleanupSuggestionDto {
    return {
        id: suggestion.id,
        userId: suggestion.userId,
        jobId: suggestion.jobId,
        taskId: suggestion.taskId,
        kind: suggestion.kind,
        currentValue: suggestion.currentValue,
        proposedValue: suggestion.proposedValue,
        rationale: suggestion.rationale,
        status: suggestion.status,
        error: suggestion.error,
        createdAt: suggestion.createdAt.toISOString(),
        resolvedAt: suggestion.resolvedAt !== null ? suggestion.resolvedAt.toISOString() : null,
    };
}
