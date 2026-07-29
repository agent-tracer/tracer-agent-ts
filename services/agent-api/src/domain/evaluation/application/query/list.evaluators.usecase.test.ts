import { describe, expect, it } from "vitest";
import { EvaluatorDefinition } from "~agent-api/domain/evaluation/model/evaluator.model.js";
import { evaluationHarness, TEST_NOW } from "../evaluation.test.fixture.js";
import { ListEvaluatorsUseCase } from "./list.evaluators.usecase.js";

describe("ListEvaluatorsUseCase", () => {
    it("활성 평가자 정의를 나열한다", async () => {
        const { repository } = evaluationHarness();
        await repository.saveEvaluatorDefinition(EvaluatorDefinition.create({
            id: "evaluator-1",
            name: "schema",
            kind: "deterministic",
            version: "1",
            config: {},
            implementationHash: "hash",
            enabled: true,
            createdAt: TEST_NOW,
        }));
        const result = await new ListEvaluatorsUseCase(repository).execute();
        expect(result.evaluators).toHaveLength(1);
    });
});
