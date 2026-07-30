import { describe, expect, it } from "vitest";
import type { ExperimentRandomPort } from "~agent-api/domain/evaluation/port/experiment.support.port.js";
import { anExecution, anExperiment, experimentHarness } from "../experiment.test.fixture.js";
import { DrawReviewPairUseCase } from "./draw.review.pair.usecase.js";

const FIRST: ExperimentRandomPort = { number: () => 0, boolean: () => false };

describe("DrawReviewPairUseCase", () => {
    it("같은 예시의 다른 변형이 낸 성공 실행 둘을 짝으로 낸다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment());
        repository.executions.push(
            anExecution(),
            anExecution({ id: "execution-2", variantId: "variant-2", output: { answer: "다른 값" } }),
        );

        const pair = await new DrawReviewPairUseCase(repository, FIRST).execute("user-1", "experiment-1");

        expect(pair).toEqual({
            executionA: { id: "execution-1", output: { answer: "값" } },
            executionB: { id: "execution-2", output: { answer: "다른 값" } },
            exampleId: "example-1",
            repetition: 1,
        });
    });

    it("같은 변형의 실행끼리는 짝을 이루지 않는다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment());
        repository.executions.push(anExecution(), anExecution({ id: "execution-2" }));

        expect(await new DrawReviewPairUseCase(repository, FIRST).execute("user-1", "experiment-1")).toBeNull();
    });

    it("성공하지 않은 실행은 짝의 후보가 아니다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment());
        repository.executions.push(
            anExecution(),
            anExecution({ id: "execution-2", variantId: "variant-2", status: "failed" }),
        );

        expect(await new DrawReviewPairUseCase(repository, FIRST).execute("user-1", "experiment-1")).toBeNull();
    });

    it("남의 실험에서는 짝을 뽑지 않는다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment());

        await expect(new DrawReviewPairUseCase(repository, FIRST).execute("user-2", "experiment-1"))
            .rejects.toThrow();
    });
});
