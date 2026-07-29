import { describe, expect, it } from "vitest";
import { evaluationHarness, seedDataset } from "../evaluation.test.fixture.js";
import { ListDatasetsUseCase } from "./list.datasets.usecase.js";

describe("ListDatasetsUseCase", () => {
    it("사용자 소유 데이터셋만 나열한다", async () => {
        const { repository } = evaluationHarness();
        await seedDataset(repository);
        const result = await new ListDatasetsUseCase(repository).execute("user-1");
        expect(result.datasets.map((row) => row.id)).toEqual(["dataset-1"]);
    });
});
