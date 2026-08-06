import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentCases, readContractJson } from "~agent-worker/support/contract.js";
import {
    RECIPE_EMPTY_RESULT_REASON,
    recipeEmptyResultReason,
    type RecipeEmptyResultSignals,
} from "./recipe.outcome.model.js";

interface EmptyResultCase {
    readonly name: string;
    readonly input: RecipeEmptyResultSignals;
    readonly expect: { readonly executionOutcome: string; readonly emptyResultReason: string };
}

const DECLARED = readAgentCases<{
    executionBudget: {
        readonly emptyResultReason: {
            readonly values: readonly string[];
            readonly default: string;
            readonly cases: readonly EmptyResultCase[];
        };
    };
}>(AGENT.recipeScan.id).executionBudget.emptyResultReason;

const VOCABULARY = readContractJson<{
    orchestratorFailureDemotion: {
        readonly emptyResultReason: {
            readonly values: Readonly<Record<string, string>>;
            readonly default: string;
        };
    };
}>("agent/shared/execution.budget.json").orchestratorFailureDemotion.emptyResultReason;

describe("빈 결과의 사유", () => {
    it("계약이 소유한 어휘를 그대로 쓴다", () => {
        expect(Object.values(RECIPE_EMPTY_RESULT_REASON).sort()).toEqual(
            Object.keys(VOCABULARY.values).sort(),
        );
        expect([...DECLARED.values].sort()).toEqual(Object.keys(VOCABULARY.values).sort());
    });

    it("아무 신호도 없는 실행은 계약이 정한 기본 사유를 낸다", () => {
        expect(recipeEmptyResultReason({})).toBe(VOCABULARY.default);
        expect(VOCABULARY.default).toBe(DECLARED.default);
    });

    it("계약의 케이스마다 같은 사유를 낸다", () => {
        expect(DECLARED.cases.length).toBeGreaterThan(0);
        for (const declared of DECLARED.cases) {
            expect(recipeEmptyResultReason(declared.input), declared.name).toBe(
                declared.expect.emptyResultReason,
            );
        }
    });
});
