import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentCases } from "~agent-worker/support/contract.js";
import { recipeCandidatesListSchema, type RecipeCandidatePayload } from "./recipe.scan.schema.js";

interface CandidateSchemaCase {
    readonly name: string;
    readonly candidate: Partial<RecipeCandidatePayload>;
    readonly expect: { readonly accepted: boolean; readonly field?: string };
}

const CONTRACT = readAgentCases<{
    cases: {
        readonly candidateDefaults: RecipeCandidatePayload;
        readonly candidateSchema: { readonly cases: readonly CandidateSchemaCase[] };
    };
}>(AGENT.recipeScan.id).cases;

/** 케이스는 새로 더한 칸만 적으므로 나머지 칸은 계약이 정한 기본 후보에서 채운다. */
function parse(declared: CandidateSchemaCase): ReturnType<typeof recipeCandidatesListSchema.safeParse> {
    return recipeCandidatesListSchema.safeParse({
        recipes: [{ ...CONTRACT.candidateDefaults, ...declared.candidate }],
    });
}

describe("레시피 후보를 읽어 들이는 자리", () => {
    it("계약의 케이스마다 같은 후보를 받고 같은 후보를 거절한다", () => {
        expect(CONTRACT.candidateSchema.cases.length).toBeGreaterThan(0);
        for (const declared of CONTRACT.candidateSchema.cases) {
            const result = parse(declared);

            expect(result.success, declared.name).toBe(declared.expect.accepted);
            if (declared.expect.field === undefined) continue;
            const fields = result.error!.issues.map((issue) => issue.path[2]);
            expect(fields, declared.name).toContain(declared.expect.field);
        }
    });
});
