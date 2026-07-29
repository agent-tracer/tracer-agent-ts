import { Column, Entity, PrimaryColumn } from "typeorm";
import type { HumanReview, HumanReviewRevision } from "../model/human.review.model.js";

@Entity({ name: "human_reviews" })
export class HumanReviewRow {
    @PrimaryColumn("text") id!: string;
    @Column("text") experimentId!: string;
    @Column("text") userId!: string;
    @Column("text") reviewerUserId!: string;
    @Column("text") executionAId!: string;
    @Column("text") executionBId!: string;
    @Column("text") preference!: HumanReview["preference"];
    @Column("text", { nullable: true }) reason!: string | null;
    @Column("jsonb", { nullable: true }) correctedOutput!: Record<string, unknown> | null;
    @Column("timestamptz") createdAt!: Date;
}

@Entity({ name: "human_review_revisions" })
export class HumanReviewRevisionRow {
    @PrimaryColumn("text") id!: string;
    @Column("text") reviewId!: string;
    @Column("text") preference!: HumanReviewRevision["preference"];
    @Column("text", { nullable: true }) reason!: string | null;
    @Column("jsonb", { nullable: true }) correctedOutput!: Record<string, unknown> | null;
    @Column("timestamptz") createdAt!: Date;
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
