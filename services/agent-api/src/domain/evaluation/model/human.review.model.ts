export type HumanReviewPreference = "a" | "b" | "tie";

export interface HumanReview {
    readonly id: string;
    readonly experimentId: string;
    readonly userId: string;
    readonly reviewerUserId: string;
    readonly executionAId: string;
    readonly executionBId: string;
    preference: HumanReviewPreference;
    reason: string | null;
    correctedOutput: Record<string, unknown> | null;
    readonly createdAt: Date;
}

export interface HumanReviewRevision {
    readonly id: string;
    readonly reviewId: string;
    readonly preference: HumanReviewPreference;
    readonly reason: string | null;
    readonly correctedOutput: Record<string, unknown> | null;
    readonly createdAt: Date;
}
