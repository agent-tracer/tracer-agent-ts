import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/** 이 워커가 후보를 적는 레시피 원장의 표이며 스키마의 진실은 계약의 SQL 이다. */
@Entity({ name: "recipes" })
@Index("recipes_user_status", ["userId", "status", "updatedAt"])
export class RecipeRowEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    status!: string;

    @Column({ type: "text" })
    title!: string;

    @Column({ type: "text" })
    intent!: string;

    @Column({ type: "text" })
    description!: string;

    @Column({ name: "use_when", type: "jsonb", default: () => "'[]'" })
    useWhen!: unknown[];

    @Column({ name: "summary_md", type: "text" })
    summaryMd!: string;

    @Column({ type: "text", default: "" })
    request!: string;

    @Column({ type: "jsonb", default: () => "'[]'" })
    inputs!: unknown[];

    @Column({ type: "jsonb", default: () => "'[]'" })
    outputs!: unknown[];

    @Column({ type: "jsonb", default: () => "'[]'" })
    corrections!: unknown[];

    @Column({ type: "jsonb", default: () => "'[]'" })
    pitfalls!: unknown[];

    @Column({ type: "jsonb", default: () => "'[]'" })
    recovery!: unknown[];

    @Column({ name: "governing_rules", type: "jsonb", default: () => "'[]'" })
    governingRules!: unknown[];

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
    lastEditedBy!: string;

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
