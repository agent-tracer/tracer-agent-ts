import {
    RECIPE_OUTCOME,
    type RecipeInjectedVia,
    type RecipeOutcome,
} from "~agent-api/domain/recipe/model/recipe.const.js";

/** 레시피 하나가 태스크 하나에 쓰인 이력이며 결과는 에이전트의 자기보고로 채워진다. */
export class RecipeApplication {
    id!: string;

    userId!: string;

    recipeId!: string;

    taskId!: string;

    injectedVia!: RecipeInjectedVia;

    outcome!: RecipeOutcome | null;

    note!: string | null;

    /** 이 행을 만든 사건이며 자기보고가 즉석에서 만든 행은 사건이 없어 비어 있다. */
    anchorEventId!: string | null;

    anchorSeq!: string | null;

    createdAt!: Date;

    /** 다시 보고하면 앞의 결과를 덮는다. */
    reportOutcome(outcome: RecipeOutcome, note: string | null): void {
        this.outcome = outcome;
        this.note = note;
    }
}

/** 적용 이력을 집계한 값이며 자기보고가 붙지 않은 적용은 성공률의 분모에 들지 않는다. */
export interface RecipeStats {
    readonly applicationCount: number;
    readonly decidedCount: number;
    readonly successRate: number;
}

export function recipeStats(applications: readonly RecipeApplication[]): RecipeStats {
    const decided = applications.filter((application) => application.outcome !== null);
    const succeeded = decided.filter((application) => application.outcome === RECIPE_OUTCOME.completed);
    return {
        applicationCount: applications.length,
        decidedCount: decided.length,
        successRate: decided.length > 0 ? succeeded.length / decided.length : 0,
    };
}
