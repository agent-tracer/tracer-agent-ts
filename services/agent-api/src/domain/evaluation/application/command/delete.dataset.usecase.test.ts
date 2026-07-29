import { describe, expect, it } from "vitest";
import { evaluationHarness, seedDataset } from "../evaluation.test.fixture.js";
import { DeleteDatasetUseCase } from "./delete.dataset.usecase.js";

describe("DeleteDatasetUseCase", () => {
    it("사용자가 소유한 데이터셋을 지운다", async () => {
        const { repository } = evaluationHarness();
        await seedDataset(repository);
        await new DeleteDatasetUseCase(repository).execute("user-1", "dataset-1");
        await expect(repository.findDataset("user-1", "dataset-1")).resolves.toBeNull();
    });
});
