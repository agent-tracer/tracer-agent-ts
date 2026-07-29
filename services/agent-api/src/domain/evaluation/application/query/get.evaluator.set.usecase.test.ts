import { describe, expect, it } from "vitest";
import { EvaluatorDefinition, EvaluatorSet, EvaluatorSetMember } from "~agent-api/domain/evaluation/model/evaluator.model.js";
import { evaluationHarness, TEST_NOW } from "../evaluation.test.fixture.js";
import { GetEvaluatorSetUseCase } from "./get.evaluator.set.usecase.js";

describe("GetEvaluatorSetUseCase", () => {
    it("버전으로 평가자 세트 구성을 읽는다", async () => {
        const { repository } = evaluationHarness();
        const evaluator = Object.assign(new EvaluatorDefinition(), { id: "evaluator-1", enabled: true });
        repository.seedEvaluatorSet({
            set: Object.assign(new EvaluatorSet(), { id: "set-1", version: "default-v1", createdAt: TEST_NOW }),
            members: [{
                membership: Object.assign(new EvaluatorSetMember(), {
                    id: "member-1",
                    setId: "set-1",
                    evaluatorDefinitionId: "evaluator-1",
                    ordinal: 0,
                }),
                evaluator,
            }],
        });
        const result = await new GetEvaluatorSetUseCase(repository).execute("default-v1");
        expect(result.members).toHaveLength(1);
    });
});
