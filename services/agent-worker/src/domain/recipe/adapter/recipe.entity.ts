import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import {
    RECIPE_EDITOR_AGENT,
    RECIPE_STATUS_CANDIDATE,
} from "~agent-worker/domain/recipe/model/recipe.const.js";
import type { GeneratedRecipeCandidate } from "~agent-worker/domain/recipe/model/recipe.candidate.model.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";

export interface RecipeCandidateEntityInput extends Omit<GeneratedRecipeCandidate, "revisesRecipeId" | "revisesRecipeIdSeenRev"> {
    readonly userId: string;
    readonly language: OutputLanguage;
    readonly sourceJobId: string;
    readonly parentRecipeId?: string;
}

/** 생성된 레시피 후보와 사용자의 수정 이력을 저장하는 행이다. */
@Entity({ name: "recipes" })
@Index("recipes_user_status", ["userId", "status", "updatedAt"])
export class RecipeEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    title!: string;

    @Column({ type: "text" })
    intent!: string;

    @Column({ type: "text" })
    description!: string;

    @Column({ name: "summary_md", type: "text" })
    summaryMd!: string;

    @Column({ type: "text", default: "" })
    request!: string;

    @Column({ type: "jsonb", default: [] })
    corrections!: unknown[];

    @Column({ type: "jsonb", default: [] })
    pitfalls!: unknown[];

    @Column({ name: "governing_rules", type: "jsonb", default: [] })
    governingRules!: string[];

    @Column({ type: "jsonb", default: [] })
    steps!: unknown[];

    @Column({ name: "touched_files", type: "jsonb", default: [] })
    touchedFiles!: unknown[];

    @Column({ name: "contributing_slices", type: "jsonb", default: [] })
    contributingSlices!: unknown[];

    @Column({ type: "text", nullable: true })
    rationale!: string | null;

    @Column({ type: "text", nullable: true })
    language!: OutputLanguage | null;

    @Column({ type: "text" })
    status!: string;

    @Column({ name: "last_edited_by", type: "text" })
    lastEditedBy!: string;

    @Column({ name: "user_edited", type: "boolean" })
    userEdited!: boolean;

    @Column({ type: "integer" })
    rev!: number;

    @Column({ name: "source_job_id", type: "text", nullable: true })
    sourceJobId!: string | null;

    @Column({ name: "parent_recipe_id", type: "text", nullable: true })
    parentRecipeId!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null;

    @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
    deletedAt!: Date | null;

    static candidate(input: RecipeCandidateEntityInput, now: Date): RecipeEntity {
        return Object.assign(new RecipeEntity(), input, {
            corrections: [...input.corrections],
            pitfalls: [...input.pitfalls],
            governingRules: [...input.governingRules],
            steps: [...input.steps],
            touchedFiles: [...input.touchedFiles],
            contributingSlices: [...input.contributingSlices],
            rationale: input.rationale,
            language: input.language,
            sourceJobId: input.sourceJobId,
            status: RECIPE_STATUS_CANDIDATE,
            lastEditedBy: RECIPE_EDITOR_AGENT,
            userEdited: false,
            rev: 1,
            parentRecipeId: input.parentRecipeId ?? null,
            error: null,
            createdAt: now,
            updatedAt: now,
            resolvedAt: null,
            deletedAt: null,
        });
    }

    isRevisionStale(observedRev: number): boolean {
        return this.rev !== observedRev;
    }
}
