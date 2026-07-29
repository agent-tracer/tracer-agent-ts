import { describe, expect, it } from "vitest";
import { evaluationHarness, seedDataset, TEST_POLICY } from "../evaluation.test.fixture.js";
import { ExportDpoUseCase } from "./export.dpo.usecase.js";

describe("ExportDpoUseCase", () => {
    it("같은 사례의 점수 차이를 선호 쌍으로 내보낸다", async () => {
        const { repository, clock } = evaluationHarness();
        await seedDataset(repository);
        repository.seedExperiment("user-1", {
            id: "experiment-1",
            datasetId: "dataset-1",
            datasetRevision: 1,
            status: "completed",
        });
        repository.seedExecutions("experiment-1", [
            { id: "high", exampleId: "example-1", variantId: "sdk.candidate", status: "succeeded", output: { answer: "좋음" } },
            { id: "low", exampleId: "example-1", variantId: "lan.candidate", status: "succeeded", output: { answer: "나쁨" } },
        ]);
        repository.seedScores("high", [{ score: 1 }]);
        repository.seedScores("low", [{ score: 0 }]);
        const result = await new ExportDpoUseCase(repository, clock)
            .execute("user-1", "dataset-1", 1, "experiment-1", TEST_POLICY);
        expect(result.entries).toHaveLength(1);
    });
});
