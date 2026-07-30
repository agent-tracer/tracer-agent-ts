import type { GeneratedCleanupSuggestion } from "~agent-worker/domain/cleanup/model/cleanup.suggestion.model.js";

export interface CleanupSuggestionBatch {
    readonly userId: string;
    /** 이 한 벌을 낸 실행이며 창구가 제안 행에 그대로 적는다. */
    readonly jobId: string;
    readonly suggestions: readonly GeneratedCleanupSuggestion[];
}

/** 제안 한 벌을 추적 서비스의 산출물 창구에 맡기는 계약이며 원자성은 그 창구가 지킨다. */
export interface CleanupOutputPort {
    /** 만들어졌거나 고쳐진 제안의 수를 내며 같은 태스크와 종류의 대기 행은 늘지 않는다. */
    createSuggestions(batch: CleanupSuggestionBatch): Promise<number>;
}
