import { describe, expect, it } from "vitest";
import { readCase } from "~agent-worker/support/contract.js";
import { RECIPE_PROMPT } from "~agent-worker/domain/recipe/port/__fakes__/recipe.test-support.js";
import type { ProvenanceSnapshot } from "./recipe.provenance.model.js";
import { renderCitableIds } from "./recipe.prompt.js";

interface CitableCase {
    readonly name: string;
    readonly input: {
        readonly taskId: string;
        readonly citableIdListLimit?: number;
        readonly provenance: ProvenanceSnapshot;
    };
    readonly mustContain?: readonly string[];
    readonly mustNotContain?: readonly string[];
}

const CASES = readCase<{ investigate: { readonly cases: readonly CitableCase[] } }>("recipe.prompt")
    .investigate.cases;

describe("조율자가 받는 인용 가능한 식별자", () => {
    it("계약의 케이스마다 같은 목록을 낸다", () => {
        for (const declared of CASES) {
            const rendered = renderCitableIds(
                RECIPE_PROMPT,
                declared.input.provenance,
                declared.input.citableIdListLimit ?? 40,
            );

            for (const line of declared.mustContain ?? []) {
                expect(rendered, declared.name).toContain(line);
            }
            for (const line of declared.mustNotContain ?? []) {
                expect(rendered, declared.name).not.toContain(line);
            }
        }
    });
});
