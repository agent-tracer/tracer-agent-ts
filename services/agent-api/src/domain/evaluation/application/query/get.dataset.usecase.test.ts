import { describe, expect, it } from "vitest";
import { evaluationHarness, seedDataset } from "../evaluation.test.fixture.js";
import { GetDatasetUseCase } from "./get.dataset.usecase.js";

describe("GetDatasetUseCase", () => {
    it("현재 개정의 사례를 함께 읽는다", async () => {
        const { repository } = evaluationHarness();
        await seedDataset(repository);
        const result = await new GetDatasetUseCase(repository).execute("user-1", "dataset-1");
        expect(result.examples).toHaveLength(1);
    });
});
