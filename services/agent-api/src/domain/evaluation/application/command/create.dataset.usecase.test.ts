import { describe, expect, it } from "vitest";
import { evaluationHarness } from "../evaluation.test.fixture.js";
import { CreateDatasetUseCase } from "./create.dataset.usecase.js";

describe("CreateDatasetUseCase", () => {
    it("데이터셋과 첫 개정의 사례를 만든다", async () => {
        const { repository, ids, clock } = evaluationHarness();
        const useCase = new CreateDatasetUseCase(repository, ids, clock);
        const result = await useCase.execute({
            userId: "user-1",
            name: "회귀",
            examples: [{ input: { value: 1 }, disclosureClass: "synthetic" }],
        });
        expect(result.dataset.currentRevision).toBe(1);
        expect(result.examples[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });
});
