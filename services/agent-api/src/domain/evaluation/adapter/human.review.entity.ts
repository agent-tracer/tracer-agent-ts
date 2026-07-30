import { Column, Entity, PrimaryColumn } from "typeorm";
import type { HumanReview, HumanReviewRevision } from "../model/human.review.model.js";

@Entity({ name: "human_reviews" })
export class HumanReviewRow {
    @PrimaryColumn("text") id!: string;
    @Column({ name: "experiment_id", type: "text" }) experimentId!: string;
    @Column({ name: "user_id", type: "text" }) userId!: string;
    @Column({ name: "reviewer_user_id", type: "text" }) reviewerUserId!: string;
    @Column({ name: "execution_a_id", type: "text" }) executionAId!: string;
    @Column({ name: "execution_b_id", type: "text" }) executionBId!: string;
    @Column("text") preference!: HumanReview["preference"];
    @Column("text", { nullable: true }) reason!: string | null;
    @Column({ name: "corrected_output", type: "jsonb", nullable: true }) correctedOutput!: Record<string, unknown> | null;
    @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}

@Entity({ name: "human_review_revisions" })
export class HumanReviewRevisionRow {
    @PrimaryColumn("text") id!: string;
    @Column({ name: "review_id", type: "text" }) reviewId!: string;
    @Column("text") preference!: HumanReviewRevision["preference"];
    @Column("text", { nullable: true }) reason!: string | null;
    @Column({ name: "corrected_output", type: "jsonb", nullable: true }) correctedOutput!: Record<string, unknown> | null;
    @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}

export function toHumanReview(row: HumanReviewRow): HumanReview {
    return { ...row };
}
export function toHumanReviewRow(model: HumanReview): HumanReviewRow {
    return Object.assign(new HumanReviewRow(), model);
}
export function toHumanReviewRevision(row: HumanReviewRevisionRow): HumanReviewRevision {
    return { ...row };
}
export function toHumanReviewRevisionRow(model: HumanReviewRevision): HumanReviewRevisionRow {
    return Object.assign(new HumanReviewRevisionRow(), model);
}
