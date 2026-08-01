import { describe, expect, it } from "vitest";
import { InMemoryEvaluationRepository } from "~agent-api/domain/evaluation/port/__fakes__/in-memory.evaluation.repository.js";
import { ListEvaluatorSetsUseCase } from "./list.evaluator.sets.usecase.js";

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

function harness() {
    const repository = new InMemoryEvaluationRepository();
    return { repository, usecase: new ListEvaluatorSetsUseCase(repository) };
}

describe("평가자 묶음 목록", () => {
    it("묶음이 없으면 빈 목록을 낸다", async () => {
        const { usecase } = harness();

        expect(await usecase.execute()).toEqual({ sets: [] });
    });

    it("판과 만든 시각과 평가자 수를 낸다", async () => {
        const { repository, usecase } = harness();
        repository.seedEvaluatorSet({
            set: { id: "set-1", version: "default-v1", createdAt: CREATED_AT },
            members: [
                { membership: { id: "member-1", setId: "set-1", evaluatorDefinitionId: "evaluator-1", ordinal: 0 }, evaluator: { id: "evaluator-1" } },
                { membership: { id: "member-2", setId: "set-1", evaluatorDefinitionId: "evaluator-2", ordinal: 1 }, evaluator: { id: "evaluator-2" } },
            ],
        } as never);

        expect(await usecase.execute()).toEqual({
            sets: [{ version: "default-v1", createdAt: CREATED_AT, evaluatorCount: 2 }],
        });
    });
});
