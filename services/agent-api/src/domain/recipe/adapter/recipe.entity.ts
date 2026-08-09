import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { RecipeEditor, RecipeStatus } from "~agent-api/domain/recipe/model/recipe.const.js";
import { Recipe } from "~agent-api/domain/recipe/model/recipe.model.js";

/** 레시피 원장의 PostgreSQL 저장 스키마이며 지운 행은 부분 색인이 목록 조회에서 갈라낸다. */
@Entity({ name: "recipes" })
@Index("recipes_user_status", ["userId", "status", "updatedAt"])
@Index("recipes_live_user_status", ["userId", "status", "updatedAt"], {
    where: `"deleted_at" IS NULL`,
})
export class RecipeEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    status!: RecipeStatus;

    @Column({ type: "text" })
    title!: string;

    @Column({ type: "text" })
    intent!: string;

    @Column({ type: "text" })
    description!: string;

    @Column({ name: "use_when", type: "jsonb", default: () => "'[]'" })
    useWhen!: string[];

    @Column({ name: "summary_md", type: "text" })
    summaryMd!: string;

    @Column({ type: "text", default: "" })
    request!: string;

    @Column({ type: "jsonb", default: () => "'[]'" })
    inputs!: string[];

    @Column({ type: "jsonb", default: () => "'[]'" })
    outputs!: string[];

    @Column({ type: "jsonb", default: () => "'[]'" })
    corrections!: unknown[];

    @Column({ type: "jsonb", default: () => "'[]'" })
    pitfalls!: unknown[];

    @Column({ type: "jsonb", default: () => "'[]'" })
    recovery!: unknown[];

    @Column({ name: "governing_rules", type: "jsonb", default: () => "'[]'" })
    governingRules!: string[];

    @Column({ type: "jsonb", default: () => "'[]'" })
    steps!: unknown[];

    @Column({ name: "touched_files", type: "jsonb", default: () => "'[]'" })
    touchedFiles!: unknown[];

    @Column({ name: "contributing_slices", type: "jsonb", default: () => "'[]'" })
    contributingSlices!: unknown[];

    @Column({ type: "text", nullable: true })
    rationale!: string | null;

    @Column({ type: "text", nullable: true })
    language!: string | null;

    @Column({ type: "integer", default: 1 })
    rev!: number;

    @Column({ name: "parent_recipe_id", type: "text", nullable: true })
    parentRecipeId!: string | null;

    @Column({ name: "source_job_id", type: "text", nullable: true })
    sourceJobId!: string | null;

    @Column({ name: "user_edited", type: "boolean", default: false })
    userEdited!: boolean;

    @Column({ name: "last_edited_by", type: "text", default: "agent" })
    lastEditedBy!: RecipeEditor;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null;

    @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
    deletedAt!: Date | null;
}

export function toRecipe(row: RecipeEntity): Recipe {
    const recipe = new Recipe();
    recipe.id = row.id;
    recipe.userId = row.userId;
    recipe.status = row.status;
    recipe.title = row.title;
    recipe.intent = row.intent;
    recipe.description = row.description;
    recipe.useWhen = row.useWhen;
    recipe.summaryMd = row.summaryMd;
    recipe.request = row.request;
    recipe.inputs = row.inputs;
    recipe.outputs = row.outputs;
    recipe.corrections = row.corrections;
    recipe.pitfalls = row.pitfalls;
    recipe.recovery = row.recovery;
    recipe.governingRules = row.governingRules;
    recipe.steps = row.steps;
    recipe.touchedFiles = row.touchedFiles;
    recipe.contributingSlices = row.contributingSlices;
    recipe.rationale = row.rationale;
    recipe.language = row.language;
    recipe.rev = row.rev;
    recipe.parentRecipeId = row.parentRecipeId;
    recipe.sourceJobId = row.sourceJobId;
    recipe.userEdited = row.userEdited;
    recipe.lastEditedBy = row.lastEditedBy;
    recipe.error = row.error;
    recipe.createdAt = row.createdAt;
    recipe.updatedAt = row.updatedAt;
    recipe.resolvedAt = row.resolvedAt;
    recipe.deletedAt = row.deletedAt;
    return recipe;
}

export function toRecipeRow(recipe: Recipe): RecipeEntity {
    const row = new RecipeEntity();
    row.id = recipe.id;
    row.userId = recipe.userId;
    row.status = recipe.status;
    row.title = recipe.title;
    row.intent = recipe.intent;
    row.description = recipe.description;
    row.useWhen = recipe.useWhen;
    row.summaryMd = recipe.summaryMd;
    row.request = recipe.request;
    row.inputs = recipe.inputs;
    row.outputs = recipe.outputs;
    row.corrections = recipe.corrections;
    row.pitfalls = recipe.pitfalls;
    row.recovery = recipe.recovery;
    row.governingRules = recipe.governingRules;
    row.steps = recipe.steps;
    row.touchedFiles = recipe.touchedFiles;
    row.contributingSlices = recipe.contributingSlices;
    row.rationale = recipe.rationale;
    row.language = recipe.language;
    row.rev = recipe.rev;
    row.parentRecipeId = recipe.parentRecipeId;
    row.sourceJobId = recipe.sourceJobId;
    row.userEdited = recipe.userEdited;
    row.lastEditedBy = recipe.lastEditedBy;
    row.error = recipe.error;
    row.createdAt = recipe.createdAt;
    row.updatedAt = recipe.updatedAt;
    row.resolvedAt = recipe.resolvedAt;
    row.deletedAt = recipe.deletedAt;
    return row;
}
