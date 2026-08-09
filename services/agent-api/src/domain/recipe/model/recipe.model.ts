import {
    RECIPE_EDITOR,
    RECIPE_STATUS,
    type RecipeEditor,
    type RecipeStatus,
} from "~agent-api/domain/recipe/model/recipe.const.js";
import {
    RecipeNotActiveError,
    RecipeNotCandidateError,
    RecipeNotDeletableError,
} from "~agent-api/domain/recipe/model/recipe.errors.js";

/** 사람이 고칠 수 있는 칸이며 실은 칸만 덮는다. */
export interface RecipeRevision {
    readonly title?: string | undefined;
    readonly intent?: string | undefined;
    readonly description?: string | undefined;
    readonly summaryMd?: string | undefined;
}

/** 레시피 원장 행 하나의 상태와 본문을 들고 상태 전이의 조건을 지킨다. */
export class Recipe {
    id!: string;

    userId!: string;

    status!: RecipeStatus;

    title!: string;

    intent!: string;

    description!: string;

    useWhen!: string[];

    summaryMd!: string;

    request!: string;

    inputs!: string[];

    outputs!: string[];

    corrections!: unknown[];

    pitfalls!: unknown[];

    recovery!: unknown[];

    governingRules!: string[];

    steps!: unknown[];

    touchedFiles!: unknown[];

    contributingSlices!: unknown[];

    rationale!: string | null;

    language!: string | null;

    rev!: number;

    parentRecipeId!: string | null;

    sourceJobId!: string | null;

    userEdited!: boolean;

    lastEditedBy!: RecipeEditor;

    error!: string | null;

    createdAt!: Date;

    updatedAt!: Date;

    resolvedAt!: Date | null;

    deletedAt!: Date | null;

    accept(now: Date): void {
        if (this.status !== RECIPE_STATUS.candidate) throw new RecipeNotCandidateError();
        this.status = RECIPE_STATUS.active;
        this.updatedAt = now;
        this.resolvedAt = now;
    }

    dismiss(now: Date): void {
        if (this.status !== RECIPE_STATUS.candidate) throw new RecipeNotCandidateError();
        this.status = RECIPE_STATUS.dismissed;
        this.updatedAt = now;
        this.resolvedAt = now;
    }

    /** 폐기는 채택 시점에 적은 해소 시각을 그대로 둔다. */
    retire(now: Date): void {
        if (this.status !== RECIPE_STATUS.active) throw new RecipeNotActiveError();
        this.status = RECIPE_STATUS.retired;
        this.updatedAt = now;
    }

    /** 자식 후보를 채택할 때만 일어나므로 이 전이는 상태를 먼저 보지 않는다. */
    supersede(now: Date): void {
        this.status = RECIPE_STATUS.superseded;
        this.updatedAt = now;
        this.resolvedAt = now;
    }

    canDelete(): boolean {
        return this.status === RECIPE_STATUS.dismissed || this.status === RECIPE_STATUS.retired;
    }

    /** 행을 지우지 않고 지운 시각만 적으므로 적용 이력이 가리키는 대상이 사라지지 않는다. */
    delete(now: Date): void {
        if (!this.canDelete()) throw new RecipeNotDeletableError();
        this.deletedAt = now;
        this.updatedAt = now;
    }

    isDeleted(): boolean {
        return this.deletedAt !== null;
    }

    editByUser(revision: RecipeRevision, now: Date): void {
        if (this.status !== RECIPE_STATUS.active) throw new RecipeNotActiveError();
        if (revision.title !== undefined) this.title = revision.title;
        if (revision.intent !== undefined) this.intent = revision.intent;
        if (revision.description !== undefined) this.description = revision.description;
        if (revision.summaryMd !== undefined) this.summaryMd = revision.summaryMd;
        this.userEdited = true;
        this.lastEditedBy = RECIPE_EDITOR.user;
        this.rev += 1;
        this.updatedAt = now;
    }
}

/** jsonb 로 저장돼 모양을 신뢰할 수 없는 슬라이스에서 인용된 태스크 식별자만 중복 없이 모은다. */
export function citedTaskIds(recipes: readonly Recipe[]): readonly string[] {
    const ids = new Set<string>();
    for (const recipe of recipes) {
        for (const slice of recipe.contributingSlices) {
            const taskId = (slice as { readonly taskId?: unknown }).taskId;
            if (typeof taskId === "string" && taskId.length > 0) ids.add(taskId);
        }
    }
    return [...ids];
}
