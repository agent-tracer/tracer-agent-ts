import type { GeneratedRecipeCandidate } from "~agent-worker/domain/recipe/model/recipe.candidate.model.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";

export interface RecipeCandidateBatch {
    readonly userId: string;
    readonly language: OutputLanguage;
    /** 이 한 벌을 낸 실행이며 같은 값으로 두 번 적으면 앞의 후보가 그대로 남는다. */
    readonly sourceJobId: string;
    readonly recipes: readonly GeneratedRecipeCandidate[];
}

/** 후보 한 벌을 자기 원장에 적는 계약이며 색인 적재까지 한 커밋으로 묶는다. */
export interface RecipeOutputPort {
    /** 적힌 후보의 수를 내며 한 호출은 전부 쓰이거나 아무것도 쓰이지 않는다. */
    createCandidates(batch: RecipeCandidateBatch): Promise<number>;
}
