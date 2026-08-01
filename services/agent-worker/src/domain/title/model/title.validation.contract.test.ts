import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentCases } from "~agent-worker/support/contract.js";
import type { TitleSuggestionPayload } from "./title.suggestion.schema.js";
import { validateTitleSuggestions } from "./title.validation.model.js";

interface TitleValidationCase {
    readonly name: string;
    readonly suggestions: readonly TitleSuggestionPayload[];
    readonly expect: { readonly valid: boolean; readonly errors: readonly string[] };
}

const CONTRACT = readAgentCases<{
    cases: { readonly currentTitle: string; readonly cases: readonly TitleValidationCase[] };
}>(AGENT.titleSuggestion.id).cases;

describe("제목 제안 검증", () => {
    it("계약의 케이스마다 같은 판정과 같은 사유를 낸다", () => {
        for (const declared of CONTRACT.cases) {
            const errors = validateTitleSuggestions(declared.suggestions, CONTRACT.currentTitle);

            expect(errors, declared.name).toEqual(declared.expect.errors);
            expect(errors.length === 0, declared.name).toBe(declared.expect.valid);
        }
    });
});
