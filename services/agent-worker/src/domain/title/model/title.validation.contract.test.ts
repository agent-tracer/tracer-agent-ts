import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentCases } from "~agent-worker/support/contract.js";
import type { TitleSuggestionPayload } from "./title.suggestion.schema.js";
import { normalizeTitleSuggestions } from "./title.validation.model.js";

interface TitleNormalizationCase {
    readonly name: string;
    readonly suggestions: readonly TitleSuggestionPayload[];
    readonly expect: { readonly kept: readonly string[]; readonly errors: readonly string[] };
}

const CONTRACT = readAgentCases<{
    cases: { readonly currentTitle: string; readonly cases: readonly TitleNormalizationCase[] };
}>(AGENT.titleSuggestion.id).cases;

describe("제목 제안 정규화", () => {
    it("계약의 케이스마다 같은 잔여 목록과 같은 사유를 낸다", () => {
        for (const declared of CONTRACT.cases) {
            const { kept, errors } = normalizeTitleSuggestions(declared.suggestions, CONTRACT.currentTitle);

            expect(
                kept.map((suggestion) => suggestion.title),
                declared.name,
            ).toEqual(declared.expect.kept);
            expect(errors, declared.name).toEqual(declared.expect.errors);
        }
    });
});
