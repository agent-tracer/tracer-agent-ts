import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { RecipeInjectedVia, RecipeOutcome } from "~agent-api/domain/recipe/model/recipe.const.js";
import { RecipeApplication } from "~agent-api/domain/recipe/model/recipe.application.model.js";

/** 적용 이력의 PostgreSQL 저장 스키마이며 행은 사건 투영과 자기보고 두 길로 생긴다. */
@Entity({ name: "recipe_applications" })
@Index("recipe_applications_task", ["taskId"])
@Index("recipe_applications_recipe", ["recipeId", "createdAt"])
export class RecipeApplicationEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "recipe_id", type: "text" })
    recipeId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "injected_via", type: "text" })
    injectedVia!: RecipeInjectedVia;

    @Column({ type: "text", nullable: true })
    outcome!: RecipeOutcome | null;

    @Column({ type: "text", nullable: true })
    note!: string | null;

    @Column({ name: "anchor_event_id", type: "text", nullable: true })
    anchorEventId!: string | null;

    // 원장이 매긴 일련번호는 정수 범위를 넘을 수 있으므로 문자열로 든다.
    @Column({ name: "anchor_seq", type: "bigint", nullable: true })
    anchorSeq!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}

export function toRecipeApplication(row: RecipeApplicationEntity): RecipeApplication {
    const application = new RecipeApplication();
    application.id = row.id;
    application.userId = row.userId;
    application.recipeId = row.recipeId;
    application.taskId = row.taskId;
    application.injectedVia = row.injectedVia;
    application.outcome = row.outcome;
    application.note = row.note;
    application.anchorEventId = row.anchorEventId;
    application.anchorSeq = row.anchorSeq;
    application.createdAt = row.createdAt;
    return application;
}

export function toRecipeApplicationRow(application: RecipeApplication): RecipeApplicationEntity {
    const row = new RecipeApplicationEntity();
    row.id = application.id;
    row.userId = application.userId;
    row.recipeId = application.recipeId;
    row.taskId = application.taskId;
    row.injectedVia = application.injectedVia;
    row.outcome = application.outcome;
    row.note = application.note;
    row.anchorEventId = application.anchorEventId;
    row.anchorSeq = application.anchorSeq;
    row.createdAt = application.createdAt;
    return row;
}
