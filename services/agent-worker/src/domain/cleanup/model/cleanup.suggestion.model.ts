import type { CleanupCandidate } from "./cleanup.candidate.model.js";
import type { CleanupSuggestionPayload } from "./cleanup.suggestion.schema.js";

/** 저장 가능한 형태로 조립된 보관 제안이다. */
export interface GeneratedCleanupSuggestion {
    readonly id: string;
    readonly taskId: string;
    readonly rationale: string;
    /** 제안을 만들 때 서버가 관찰한 대상 태스크의 마지막 이벤트 시각이다. */
    readonly observedLastEventAt: string | null;
}

/** 후보 목록에 없는 태스크 인용과 같은 태스크의 중복 제안을 걷어낸다. */
export function assembleCleanupSuggestions(
    suggestions: readonly CleanupSuggestionPayload[],
    candidates: readonly CleanupCandidate[],
    maxSuggestions: number,
    nextId: () => string,
): readonly GeneratedCleanupSuggestion[] {
    const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate] as const));
    const seen = new Set<string>();
    const assembled: GeneratedCleanupSuggestion[] = [];
    for (const suggestion of suggestions) {
        if (assembled.length >= maxSuggestions) break;
        const candidate = candidatesById.get(suggestion.taskId);
        if (candidate === undefined || seen.has(suggestion.taskId)) continue;
        seen.add(suggestion.taskId);
        assembled.push({
            id: nextId(),
            taskId: suggestion.taskId,
            rationale: suggestion.rationale,
            observedLastEventAt: candidate.lastEventAt,
        });
    }
    return assembled;
}

/** 완료 알림에 실을 요약 문장이다. */
export function taskCleanupSummary(suggestionsCreated: number, tasksScanned: number): string {
    if (suggestionsCreated === 0) return `No cleanup suggestions for ${tasksScanned} tasks`;
    const noun = suggestionsCreated === 1 ? "suggestion" : "suggestions";
    return `${suggestionsCreated} cleanup ${noun} for ${tasksScanned} tasks`;
}
