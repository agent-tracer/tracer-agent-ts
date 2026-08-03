import type { CleanupCandidate } from "./cleanup.candidate.model.js";
import type { CleanupSuggestionPayload } from "./cleanup.suggestion.schema.js";

/** 산출물 창구로 보낼 수 있는 형태로 조립된 보관 제안이며 식별자와 대조할 값은 창구가 정한다. */
export interface GeneratedCleanupSuggestion {
    readonly taskId: string;
    readonly rationale: string;
}

/** 후보 목록에 없는 태스크 인용과 같은 태스크의 중복 제안을 제거한다. */
export function assembleCleanupSuggestions(
    suggestions: readonly CleanupSuggestionPayload[],
    candidates: readonly CleanupCandidate[],
    maxSuggestions: number,
): readonly GeneratedCleanupSuggestion[] {
    const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate] as const));
    const seen = new Set<string>();
    const assembled: GeneratedCleanupSuggestion[] = [];
    for (const suggestion of suggestions) {
        if (assembled.length >= maxSuggestions) break;
        const candidate = candidatesById.get(suggestion.taskId);
        if (candidate === undefined || seen.has(suggestion.taskId)) continue;
        seen.add(suggestion.taskId);
        assembled.push({ taskId: suggestion.taskId, rationale: suggestion.rationale });
    }
    return assembled;
}

/** 완료 알림에 실을 요약 문장이다. */
export function taskCleanupSummary(suggestionsCreated: number, tasksScanned: number): string {
    if (suggestionsCreated === 0) return `No cleanup suggestions for ${tasksScanned} tasks`;
    const noun = suggestionsCreated === 1 ? "suggestion" : "suggestions";
    return `${suggestionsCreated} cleanup ${noun} for ${tasksScanned} tasks`;
}
