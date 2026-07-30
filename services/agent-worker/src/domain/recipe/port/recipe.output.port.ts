import type { GeneratedRecipeCandidate } from "~agent-worker/domain/recipe/model/recipe.candidate.model.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";

export interface RecipeCandidateBatch {
    readonly userId: string;
    readonly language: OutputLanguage;
    /** 이 한 벌을 낸 실행이며 같은 값으로 두 번 부르면 앞의 결과가 그대로 온다. */
    readonly sourceJobId: string;
    readonly recipes: readonly GeneratedRecipeCandidate[];
}

/** 후보 한 벌을 추적 서비스의 산출물 창구에 맡기는 계약이며 원자성은 그 창구가 지킨다. */
export interface RecipeOutputPort {
    /** 만들어진 후보의 수를 내며 한 호출은 전부 쓰이거나 아무것도 쓰이지 않는다. */
    createCandidates(batch: RecipeCandidateBatch): Promise<number>;
}
