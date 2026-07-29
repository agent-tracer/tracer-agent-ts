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

/** 보관 제안이 도구가 돌려준 후보와 이벤트만 인용하는지 검사하고 걸린 제안만 걷어낸다. */
export function validateCleanupSuggestions(
    suggestions: readonly CleanupSuggestionPayload[],
    snapshot: CleanupProvenanceSnapshot,
    maxSuggestions: number,
): CleanupValidationResult {
    const valid: CleanupSuggestionPayload[] = [];
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const suggestion of suggestions) {
        const itemErrors = validateOne(suggestion, snapshot, seen, valid.length, maxSuggestions);
        seen.add(suggestion.taskId);
        if (itemErrors.length > 0) errors.push(...itemErrors);
        else valid.push(suggestion);
    }
    return { valid, errors };
}

function validateOne(
    suggestion: CleanupSuggestionPayload,
    snapshot: CleanupProvenanceSnapshot,
    seen: ReadonlySet<string>,
    validCount: number,
    maxSuggestions: number,
): readonly string[] {
    const taskId = suggestion.taskId;
    const errors: string[] = [];
    const candidate = exposedCandidate(snapshot, taskId);
    if (candidate === undefined) errors.push(`unsupported candidate task ID ${taskId}`);
    if (seen.has(taskId)) errors.push(`duplicate suggestion for task ${taskId}`);

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
    if (validCount >= maxSuggestions) errors.push(`suggestion limit ${maxSuggestions} exceeded`);
    return errors;
}
