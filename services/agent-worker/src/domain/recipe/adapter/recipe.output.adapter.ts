import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import { wireArray, wireObject } from "~agent-worker/support/wire.value.js";
import { RECIPE_AUTHOR_AGENT } from "~agent-worker/domain/recipe/model/recipe.const.js";
import type { GeneratedRecipeCandidate } from "~agent-worker/domain/recipe/model/recipe.candidate.model.js";
import type {
    RecipeCandidateBatch,
    RecipeOutputPort,
} from "~agent-worker/domain/recipe/port/recipe.output.port.js";

/** 후보 한 벌을 추적 API의 산출물 창구로 보내며 그 창구가 한 트랜잭션으로 쓴다. */
export class RecipeOutputAdapter implements RecipeOutputPort {
    constructor(private readonly tracer: TracerApiWindow) {}

    async createCandidates(batch: RecipeCandidateBatch): Promise<number> {
        if (batch.recipes.length === 0) return 0;
        const created = await this.tracer.request({
            method: "POST",
            path: "/api/v1/recipes",
            userId: batch.userId,
            body: {
                recipes: batch.recipes.map((recipe) => toDraft(recipe, batch.language)),
                author: RECIPE_AUTHOR_AGENT,
                sourceJobId: batch.sourceJobId,
            },
        });
        return wireArray(wireObject(created)["recipes"]).length;
    }
}

function toDraft(recipe: GeneratedRecipeCandidate, language: string): Record<string, unknown> {
    return {
        title: recipe.title,
        intent: recipe.intent,
        description: recipe.description,
        summaryMd: recipe.summaryMd,
        request: recipe.request,
        rationale: recipe.rationale,
        useWhen: recipe.useWhen,
        inputs: recipe.inputs,
        outputs: recipe.outputs,
        corrections: recipe.corrections,
        pitfalls: recipe.pitfalls,
        recovery: recipe.recovery,
        governingRules: recipe.governingRules,
        steps: recipe.steps,
        touchedFiles: recipe.touchedFiles,
        contributingSlices: recipe.contributingSlices,
        language,
        ...(recipe.parentRecipeId !== undefined
            ? { parentRecipeId: recipe.parentRecipeId, parentRecipeSeenRev: recipe.parentRecipeSeenRev }
            : {}),
    };
}
