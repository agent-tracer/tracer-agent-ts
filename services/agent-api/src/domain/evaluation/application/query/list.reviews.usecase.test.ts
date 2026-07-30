import { describe, expect, it } from "vitest";
import { EXPERIMENT_NOW, anExperiment, experimentHarness } from "../experiment.test.fixture.js";
import { ListReviewsUseCase } from "./list.reviews.usecase.js";

const REVIEW = {
    id: "review-1", experimentId: "experiment-1", userId: "user-1", reviewerUserId: "user-1",
    executionAId: "execution-1", executionBId: "execution-2", preference: "a" as const,
    reason: null, correctedOutput: null, createdAt: EXPERIMENT_NOW,
};

describe("ListReviewsUseCase", () => {
    it("그 실험의 검토만 목록의 칸에 담아 낸다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment());
        repository.reviews.push(REVIEW, { ...REVIEW, id: "review-2", experimentId: "experiment-2" });

        const result = await new ListReviewsUseCase(repository).execute("user-1", "experiment-1");

        expect(result.reviews.map((row) => row.id)).toEqual(["review-1"]);
    });

    it("남의 실험의 검토는 조회하지 않는다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment());

        await expect(new ListReviewsUseCase(repository).execute("user-2", "experiment-1")).rejects.toThrow();
    });
});
