import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentCases } from "~agent-worker/support/contract.js";
import { recipeSynthesisSchema } from "./recipe.dispatch.schema.js";
import type { RecipeCandidatePayload } from "./recipe.scan.schema.js";

interface OutputExclusivityCase {
    readonly name: string;
    readonly recipesNonEmpty: boolean;
    readonly redispatchNonEmpty: boolean;
    readonly expect: { readonly valid: boolean };
}

interface RecipeScanCases {
    readonly executionBudget: { readonly outputExclusivity: { readonly cases: readonly OutputExclusivityCase[] } };
    readonly resultExample: { readonly recipes: readonly RecipeCandidatePayload[] };
}

const { executionBudget, resultExample } = readAgentCases<RecipeScanCases>(AGENT.recipeScan.id);
const SAMPLE_CANDIDATE = resultExample.recipes[0]!;
const SAMPLE_REDISPATCH = { probe: "timeline", depth: "shallow", question: "무엇을 더 조사해야 하는가" } as const;

describe("종합 산출의 배타", () => {
    it.each(executionBudget.outputExclusivity.cases)("$name", (testCase) => {
        const candidate = {
            recipes: testCase.recipesNonEmpty ? [SAMPLE_CANDIDATE] : [],
            redispatch: testCase.redispatchNonEmpty ? [SAMPLE_REDISPATCH] : [],
        };

        const result = recipeSynthesisSchema.safeParse(candidate);
        expect(result.success).toBe(testCase.expect.valid);
    });
});
