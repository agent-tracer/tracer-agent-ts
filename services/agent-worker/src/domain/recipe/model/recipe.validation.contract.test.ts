import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentCases } from "~agent-worker/support/contract.js";
import type { ProvenanceSnapshot } from "./recipe.provenance.model.js";
import type { RecipeCandidatePayload } from "./recipe.scan.schema.js";
import { validateRecipeCandidates } from "./recipe.validation.model.js";

interface RecipeValidationCase {
    readonly name: string;
    readonly candidates: readonly Partial<RecipeCandidatePayload>[];
    readonly expect: { readonly valid: boolean; readonly errors: readonly string[] };
}

const CONTRACT = readAgentCases<{
    cases: {
        readonly anchorTaskId: string;
        readonly provenance: ProvenanceSnapshot;
        readonly candidateDefaults: RecipeCandidatePayload;
        readonly cases: readonly RecipeValidationCase[];
    };
}>(AGENT.recipeScan.id).cases;

/** 케이스는 검증이 보는 칸만 적으므로 나머지 칸은 계약이 정한 기본 후보에서 채운다. */
function candidates(declared: RecipeValidationCase): readonly RecipeCandidatePayload[] {
    return declared.candidates.map((override) => ({ ...CONTRACT.candidateDefaults, ...override }));
}

describe("레시피 후보 근거 검증", () => {
    it("계약의 케이스마다 같은 판정과 같은 사유를 낸다", () => {
        for (const declared of CONTRACT.cases) {
            const errors = validateRecipeCandidates(
                candidates(declared),
                CONTRACT.anchorTaskId,
                CONTRACT.provenance,
            );

            expect(errors, declared.name).toEqual(declared.expect.errors);
            expect(errors.length === 0, declared.name).toBe(declared.expect.valid);
        }
    });
});
