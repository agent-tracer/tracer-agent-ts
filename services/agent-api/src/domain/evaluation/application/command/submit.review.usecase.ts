import { Inject, Injectable } from "@nestjs/common";
import type { HumanReview, HumanReviewPreference, HumanReviewRevision } from "~agent-api/domain/evaluation/model/human.review.model.js";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";
import {
    EXPERIMENT_CLOCK, EXPERIMENT_ID_GENERATOR, type ExperimentClockPort, type ExperimentIdGeneratorPort,
} from "~agent-api/domain/evaluation/port/experiment.support.port.js";

export interface SubmitReviewInput {
    readonly userId: string; readonly experimentId: string;
    readonly executionAId: string; readonly executionBId: string;
    readonly preference: HumanReviewPreference; readonly reason: string | null;
    readonly correctedOutput: Record<string, unknown> | null;
}

@Injectable()
export class SubmitReviewUseCase {
    constructor(
        @Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort,
        @Inject(EXPERIMENT_ID_GENERATOR) private readonly ids: ExperimentIdGeneratorPort,
        @Inject(EXPERIMENT_CLOCK) private readonly clock: ExperimentClockPort,
    ) {}
    async execute(input: SubmitReviewInput): Promise<HumanReview> {
        const experiment = await this.repository.findExperiment(input.userId, input.experimentId);
        if (experiment === null) throw new Error("Experiment not found");
        const found = (await this.repository.listReviews(input.userId, input.experimentId)).find((row) =>
            new Set([row.executionAId, row.executionBId]).has(input.executionAId)
            && new Set([row.executionAId, row.executionBId]).has(input.executionBId));
        const reversed = found !== undefined && found.executionAId !== input.executionAId;
        const preference = reversed && input.preference !== "tie"
            ? input.preference === "a" ? "b" : "a" : input.preference;
        const now = this.clock.now();
        const review: HumanReview = found ?? {
            id: this.ids.next("review"), experimentId: input.experimentId, userId: experiment.userId,
            reviewerUserId: input.userId, executionAId: input.executionAId, executionBId: input.executionBId,
            preference, reason: input.reason, correctedOutput: input.correctedOutput, createdAt: now,
        };
        review.preference = preference;
        review.reason = input.reason;
        review.correctedOutput = input.correctedOutput;
        const revision: HumanReviewRevision = {
            id: this.ids.next("review_revision"), reviewId: review.id, preference,
            reason: input.reason, correctedOutput: input.correctedOutput, createdAt: now,
        };
        await this.repository.saveReview(review, revision);
        return review;
    }
}
