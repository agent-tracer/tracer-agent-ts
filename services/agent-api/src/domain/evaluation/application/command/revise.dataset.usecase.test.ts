import { describe, expect, it } from "vitest";
import { evaluationHarness, seedDataset } from "../evaluation.test.fixture.js";
import { ReviseDatasetUseCase } from "./revise.dataset.usecase.js";

describe("ReviseDatasetUseCase", () => {
    it("새 사례를 다음 개정에 고정한다", async () => {
        const { repository, ids } = evaluationHarness();
        await seedDataset(repository);
        const result = await new ReviseDatasetUseCase(repository, ids).execute({
            userId: "user-1",
            datasetId: "dataset-1",
            examples: [{ input: { value: 2 }, disclosureClass: "synthetic" }],
        });
        expect(result.dataset.currentRevision).toBe(2);
        expect(result.examples[0]?.revision).toBe(2);
    });
});
