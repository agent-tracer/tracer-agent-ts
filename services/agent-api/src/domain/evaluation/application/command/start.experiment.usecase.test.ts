import { describe, expect, it } from "vitest";
import { ExperimentNotFoundError, ExperimentPreviewChangedError, ExperimentStartConflictError } from "~agent-api/domain/evaluation/model/evaluation.error.js";
import { buildExperimentPreview } from "~agent-api/domain/evaluation/model/experiment.preview.model.js";
import { InMemoryExperimentRepository } from "~agent-api/domain/evaluation/port/__fakes__/in-memory.experiment.repository.js";
import { RecordingExperimentDispatcher } from "~agent-api/domain/evaluation/port/__fakes__/experiment.support.fakes.js";
import { SequentialEvaluationIdGenerator } from "~agent-api/domain/evaluation/port/__fakes__/sequential.evaluation.id.generator.js";
import { anExperiment, aVariant } from "../experiment.test.fixture.js";
import { StartExperimentUseCase } from "./start.experiment.usecase.js";

function harness(overrides: { readonly repetitions?: number } = {}) {
    const experiment = anExperiment({ repetitions: overrides.repetitions ?? 1 });
    const variants = [aVariant({ id: "variant-1" }), aVariant({ id: "variant-2", baseline: false })];
    const examples = [{ id: "example-1" }, { id: "example-2" }];

    const repository = new InMemoryExperimentRepository();
    repository.experiments.push(experiment);
    repository.variants.push(...variants);
    repository.examples.push(...examples);

    const dispatcher = new RecordingExperimentDispatcher();
    const usecase = new StartExperimentUseCase(repository, dispatcher, new SequentialEvaluationIdGenerator());
    const confirmation = buildExperimentPreview(experiment, examples, variants);
    return { repository, dispatcher, usecase, confirmation, experiment };
}

describe("실험 시작", () => {
    it("variant 와 example 과 반복의 곱만큼 실행을 세운다", async () => {
        const { repository, usecase, confirmation } = harness({ repetitions: 2 });

        await usecase.execute("user-1", "experiment-1", confirmation);

        expect(repository.executions).toHaveLength(8);
        expect(new Set(repository.executions.map((execution) => execution.id)).size).toBe(8);
    });

    it("세운 실행을 아무도 가져가지 않은 상태로 둔다", async () => {
        const { repository, usecase, confirmation } = harness();

        await usecase.execute("user-1", "experiment-1", confirmation);

        for (const execution of repository.executions) {
            expect(execution).toMatchObject({ status: "pending", attemptCount: 0, leaseOwner: null, costUsd: 0 });
        }
    });

    it("실행을 세운 뒤에 워크플로를 띄운다", async () => {
        const { repository, dispatcher, usecase, confirmation } = harness();

        await usecase.execute("user-1", "experiment-1", confirmation);

        expect(dispatcher.dispatched).toEqual([{ experimentId: "experiment-1", userId: "user-1" }]);
        expect(repository.executions.length).toBeGreaterThan(0);
    });

    it("없는 실험을 시작하면 404 로 알린다", async () => {
        const { usecase, confirmation } = harness();

        await expect(usecase.execute("user-1", "nowhere", confirmation)).rejects.toBeInstanceOf(ExperimentNotFoundError);
    });

    it("남의 실험을 시작하면 404 로 알린다", async () => {
        const { usecase, confirmation } = harness();

        await expect(usecase.execute("other", "experiment-1", confirmation)).rejects.toBeInstanceOf(ExperimentNotFoundError);
    });

    it("확인한 그림이 달라졌으면 거절한다", async () => {
        const { usecase, confirmation } = harness();

        await expect(
            usecase.execute("user-1", "experiment-1", { ...confirmation, executionCount: confirmation.executionCount + 1 }),
        ).rejects.toBeInstanceOf(ExperimentPreviewChangedError);
    });

    it("이미 시작한 실험을 다시 시작하지 않는다", async () => {
        const { usecase, confirmation } = harness();

        await usecase.execute("user-1", "experiment-1", confirmation);

        await expect(usecase.execute("user-1", "experiment-1", confirmation)).rejects.toBeInstanceOf(ExperimentNotFoundError);
    });

    it("워크플로를 띄우지 못하면 초안으로 되돌린다", async () => {
        const { repository, confirmation } = harness();
        const dispatcher = new RecordingExperimentDispatcher();
        dispatcher.dispatch = () => Promise.reject(new Error("temporal down"));
        const failing = new StartExperimentUseCase(repository, dispatcher, new SequentialEvaluationIdGenerator());

        await expect(failing.execute("user-1", "experiment-1", confirmation)).rejects.toThrow("temporal down");

        expect(repository.experiments[0]?.status).toBe("draft");
    });

    it("시작 경합에서 진 쪽은 충돌로 알린다", async () => {
        const { repository, usecase, confirmation } = harness();
        repository.claimDraft = async () => null;

        await expect(usecase.execute("user-1", "experiment-1", confirmation)).rejects.toBeInstanceOf(ExperimentStartConflictError);
    });
});
