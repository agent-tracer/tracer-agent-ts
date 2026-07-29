import { describe, expect, it } from "vitest";
import { evaluationHarness, seedDataset } from "../evaluation.test.fixture.js";
import { SuggestDatasetCandidatesUseCase } from "./suggest.dataset.candidates.usecase.js";

describe("SuggestDatasetCandidatesUseCase", () => {
    it("실패한 실행을 데이터셋 후보로 제안한다", async () => {
        const { repository, clock } = evaluationHarness();
        await seedDataset(repository);
        repository.seedExperiment("user-1", {
            id: "experiment-1",
            datasetId: "dataset-1",
            datasetRevision: 1,
            status: "completed",
        });
        repository.seedExecutions("experiment-1", [{
            id: "execution-1",
            exampleId: "example-1",
            variantId: "sdk.candidate",
            status: "failed",
            output: null,
        }]);
        const result = await new SuggestDatasetCandidatesUseCase(repository, clock)
            .execute("user-1", "experiment-1");
        expect(result[0]?.reason).toBe("failure");
    });
});
