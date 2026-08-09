import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentCases } from "~agent-worker/support/contract.js";
import type { CleanupCandidate } from "./cleanup.candidate.model.js";
import type { CleanupProvenanceSnapshot } from "./cleanup.provenance.model.js";
import type { CleanupSuggestionPayload } from "./cleanup.suggestion.schema.js";
import { filterValidCleanupSuggestions } from "./cleanup.validation.model.js";

interface CleanupValidationCase {
    readonly name: string;
    readonly maxSuggestions?: number;
    readonly inspected: Readonly<Record<string, readonly string[]>>;
    readonly suggestions: readonly Partial<CleanupSuggestionPayload>[];
    readonly expect: {
        readonly valid: boolean;
        readonly validTaskIds: readonly string[];
        readonly errors: readonly string[];
    };
}

const CONTRACT = readAgentCases<{
    cases: {
        readonly maxSuggestions: number;
        readonly candidates: readonly CleanupCandidate[];
        readonly suggestionDefaults: CleanupSuggestionPayload;
        readonly cases: readonly CleanupValidationCase[];
    };
}>(AGENT.taskCleanup.id).cases;

/** 계약이 노출된 후보로 적은 것 전부와 그 케이스가 열어 본 이벤트만 담은 장부다. */
function snapshot(declared: CleanupValidationCase): CleanupProvenanceSnapshot {
    return {
        candidatesById: Object.fromEntries(CONTRACT.candidates.map((candidate) => [candidate.id, candidate])),
        eventIdsByTask: declared.inspected,
    };
}

/** 케이스는 판정이 보는 칸만 적으므로 나머지 칸은 계약이 정한 기본 제안에서 채운다. */
function suggestions(declared: CleanupValidationCase): readonly CleanupSuggestionPayload[] {
    return declared.suggestions.map((override) => ({ ...CONTRACT.suggestionDefaults, ...override }));
}

describe("정리 제안 검증", () => {
    it("계약의 케이스마다 같은 판정과 같은 사유를 낸다", () => {
        for (const declared of CONTRACT.cases) {
            const result = filterValidCleanupSuggestions(
                suggestions(declared),
                snapshot(declared),
                declared.maxSuggestions ?? CONTRACT.maxSuggestions,
            );

            expect(result.valid.map((item) => item.taskId), declared.name).toEqual(
                declared.expect.validTaskIds,
            );
            expect(result.errors, declared.name).toEqual(declared.expect.errors);
            expect(result.errors.length === 0, declared.name).toBe(declared.expect.valid);
        }
    });
});
