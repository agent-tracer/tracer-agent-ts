import {
    exposedCandidate,
    inspectedEventIds,
    isTaskInspected,
    type CleanupProvenanceSnapshot,
} from "./cleanup.provenance.model.js";
import type { CleanupSuggestionPayload } from "./cleanup.suggestion.schema.js";

/** 검증을 통과한 제안과 모델에게 돌려줄 오류 문장을 함께 담는다. */
export interface CleanupValidationResult {
    readonly valid: readonly CleanupSuggestionPayload[];
    readonly errors: readonly string[];
}

/** 겹치거나 상한을 넘은 제안은 지우고 근거가 어긋난 제안만 모델이 고칠 사유로 남긴다. */
export function filterValidCleanupSuggestions(
    suggestions: readonly CleanupSuggestionPayload[],
    snapshot: CleanupProvenanceSnapshot,
    maxSuggestions: number,
): CleanupValidationResult {
    const valid: CleanupSuggestionPayload[] = [];
    const errors: string[] = [];

    for (const suggestion of deduplicated(suggestions)) {
        const itemErrors = evidenceErrors(suggestion, snapshot);
        if (itemErrors.length > 0) errors.push(...itemErrors);
        else valid.push(suggestion);
    }
    // 상한을 넘은 꼬리는 다시 물어도 같은 수만 남으므로 사유를 남기지 않고 그 자리에서 지운다.
    return { valid: valid.slice(0, maxSuggestions), errors };
}

/** 같은 태스크를 두 번 제안하면 뒤의 것은 앞의 것과 같은 말이라 지운다. */
function deduplicated(
    suggestions: readonly CleanupSuggestionPayload[],
): readonly CleanupSuggestionPayload[] {
    const seen = new Set<string>();
    const kept: CleanupSuggestionPayload[] = [];
    for (const suggestion of suggestions) {
        if (seen.has(suggestion.taskId)) continue;
        seen.add(suggestion.taskId);
        kept.push(suggestion);
    }
    return kept;
}

/** 제안이 도구가 실제로 보여준 후보와 이벤트에 기대는지 본다. */
function evidenceErrors(
    suggestion: CleanupSuggestionPayload,
    snapshot: CleanupProvenanceSnapshot,
): readonly string[] {
    const taskId = suggestion.taskId;
    const errors: string[] = [];
    const candidate = exposedCandidate(snapshot, taskId);
    if (candidate === undefined) errors.push(`unsupported candidate task ID ${taskId}`);

    const inspected = isTaskInspected(snapshot, taskId);
    const supported = inspectedEventIds(snapshot, taskId);
    const cited = [...new Set(suggestion.evidenceEventIds)];
    const unknown = cited.filter((eventId) => !supported.includes(eventId)).sort();
    if (unknown.length > 0) {
        errors.push(`unsupported event IDs for task ${taskId}: ${unknown.join(", ")}`);
    }
    if (candidate !== undefined && candidate.hasEvents && !inspected) {
        errors.push(`eventful task ${taskId} was never inspected`);
    } else if (supported.length > 0 && cited.length === 0) {
        errors.push(`eventful task ${taskId} has no inspected event evidence`);
    }
    return errors;
}
