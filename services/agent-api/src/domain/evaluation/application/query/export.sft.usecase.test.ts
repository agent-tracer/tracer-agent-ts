import { describe, expect, it } from "vitest";
import { evaluationHarness, seedDataset, TEST_POLICY } from "../evaluation.test.fixture.js";
import { ExportSftUseCase } from "./export.sft.usecase.js";

describe("ExportSftUseCase", () => {
    it("성공한 실행을 대화 학습 항목으로 내보낸다", async () => {
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
            status: "succeeded",
            output: { answer: "결과" },
        }]);
        const result = await new ExportSftUseCase(repository, clock)
            .execute("user-1", "dataset-1", 1, "experiment-1", TEST_POLICY);
        expect(result.manifest.entryCount).toBe(1);
    });
});
