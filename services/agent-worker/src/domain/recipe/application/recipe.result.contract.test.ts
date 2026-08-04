import { describe, expect, it } from "vitest";
import { readContractJson } from "~agent-worker/support/contract.js";
import { recipeObservation, seedRepository } from "~agent-worker/domain/recipe/port/__fakes__/recipe.test-support.js";

interface JobIntakeCase {
    readonly results: {
        readonly byKind: Record<string, { readonly required: readonly string[] }>;
    };
}

const declared = readContractJson<JobIntakeCase>("conformance/cases/job.intake.json")
    .results.byKind["recipe.scan"]!;

describe("레시피 스캔 잡의 산출", () => {
    it("계약이 적은 칸을 빠짐없이 싣는다", async () => {
        const repository = seedRepository();
        await repository.commitScan({
            jobId: "job-1",
            userId: "user-1",
            recipes: [],
            provenance: { eventIdsByTask: {}, turnIdsByTask: {}, ruleIds: [], recipeRevs: {} },
            steps: [],
            attempt: 1,
            usage: {},
            observation: recipeObservation(),
            now: new Date(),
        });

        const written = repository.commits[0]!;
        const result = { recipes: written.recipes, provenance: written.provenance };
        expect(Object.keys(result).sort()).toEqual([...declared.required].sort());
    });
});
