import type { RecipeEditor, RecipeInjectedVia, RecipeOutcome, RecipeStatus } from "~agent-api/domain/recipe/model/recipe.const.js";
import type { RecipeApplication, RecipeStats } from "~agent-api/domain/recipe/model/recipe.application.model.js";
import type { Recipe } from "~agent-api/domain/recipe/model/recipe.model.js";
import { SearchOutboxRow } from "~agent-api/domain/recipe/model/search.outbox.model.js";
import type { RecipeTx } from "~agent-api/domain/recipe/port/recipe.transaction.port.js";

/** 조회와 상태 변경이 모두 내는 레시피 한 건의 칸이며 계약의 Recipe 스키마와 같다. */
export interface RecipeDto {
    readonly id: string;
    readonly userId: string;
    readonly status: RecipeStatus;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly request: string;
    readonly corrections: readonly unknown[];
    readonly pitfalls: readonly unknown[];
    readonly governingRules: readonly string[];
    readonly steps: readonly unknown[];
    readonly touchedFiles: readonly unknown[];
    readonly contributingSlices: readonly unknown[];
    readonly rationale: string | null;
    readonly useWhen: readonly string[];
    readonly inputs: readonly string[];
    readonly outputs: readonly string[];
    readonly recovery: readonly unknown[];
    readonly language: string | null;
    readonly rev: number;
    readonly parentRecipeId: string | null;
    readonly sourceJobId: string | null;
    readonly userEdited: boolean;
    readonly lastEditedBy: RecipeEditor;
    readonly error: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly resolvedAt: string | null;
}

export interface RecipeWithStatsDto extends RecipeDto {
    readonly stats: RecipeStats;
}

/** 적용 이력 한 건의 칸이며 사건 좌표는 화면이 쓰지 않으므로 싣지 않는다. */
export interface RecipeApplicationDto {
    readonly id: string;
    readonly userId: string;
    readonly recipeId: string;
    readonly taskId: string;
    readonly injectedVia: RecipeInjectedVia;
    readonly outcome: RecipeOutcome | null;
    readonly note: string | null;
    readonly createdAt: string;
}

export function mapRecipe(recipe: Recipe): RecipeDto {
    return {
        id: recipe.id,
        userId: recipe.userId,
        status: recipe.status,
        title: recipe.title,
        intent: recipe.intent,
        description: recipe.description,
        summaryMd: recipe.summaryMd,
        request: recipe.request,
        corrections: recipe.corrections,
        pitfalls: recipe.pitfalls,
        governingRules: recipe.governingRules,
        steps: recipe.steps,
        touchedFiles: recipe.touchedFiles,
        contributingSlices: recipe.contributingSlices,
        rationale: recipe.rationale,
        useWhen: recipe.useWhen,
        inputs: recipe.inputs,
        outputs: recipe.outputs,
        recovery: recipe.recovery,
        language: recipe.language,
        rev: recipe.rev,
        parentRecipeId: recipe.parentRecipeId,
        sourceJobId: recipe.sourceJobId,
        userEdited: recipe.userEdited,
        lastEditedBy: recipe.lastEditedBy,
        error: recipe.error,
        createdAt: recipe.createdAt.toISOString(),
        updatedAt: recipe.updatedAt.toISOString(),
        resolvedAt: recipe.resolvedAt !== null ? recipe.resolvedAt.toISOString() : null,
    };
}

export function mapRecipeApplication(application: RecipeApplication): RecipeApplicationDto {
    return {
        id: application.id,
        userId: application.userId,
        recipeId: application.recipeId,
        taskId: application.taskId,
        injectedVia: application.injectedVia,
        outcome: application.outcome,
        note: application.note,
        createdAt: application.createdAt.toISOString(),
    };
}

/** 레시피 쓰기와 같은 커밋에 색인 반영 요청을 남긴다. */
export async function enqueueRecipeIndex(
    tx: RecipeTx,
    id: string,
    userId: string,
    recipeId: string,
    now: Date,
): Promise<void> {
    await tx.searchOutbox.enqueue(SearchOutboxRow.enqueueRecipe(id, userId, recipeId, now));
}
