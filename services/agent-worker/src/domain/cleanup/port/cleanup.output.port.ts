import type { GeneratedCleanupSuggestion } from "~agent-worker/domain/cleanup/model/cleanup.suggestion.model.js";

export interface CleanupSuggestionBatch {
    readonly userId: string;
    /** 이 한 벌을 낸 실행이며 제안 행에 그대로 적힌다. */
    readonly jobId: string;
    readonly suggestions: readonly GeneratedCleanupSuggestion[];
}

/** 제안 한 벌을 자기 원장에 적는 계약이며 한 커밋이 그 한 벌을 함께 담는다. */
export interface CleanupOutputPort {
    /** 적혔거나 고쳐진 제안의 수를 내며 같은 태스크와 종류의 대기 행은 늘지 않는다. */
    createSuggestions(batch: CleanupSuggestionBatch): Promise<number>;
}
