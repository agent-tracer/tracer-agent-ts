import { describe, expect, it } from "vitest";
import { aScore, aVariant, anExecution, anExperiment, experimentHarness } from "../experiment.test.fixture.js";
import { GetExperimentComparisonUseCase } from "./get.experiment.comparison.usecase.js";

describe("GetExperimentComparisonUseCase", () => {
    it("비교에 실험 식별자와 진행 상태를 함께 실어 낸다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment({ status: "completed" }));
        repository.variants.push(aVariant());
        repository.executions.push(anExecution());
        repository.scores.push(aScore());

        const result = await new GetExperimentComparisonUseCase(repository).execute("user-1", "experiment-1");

        expect(result).toMatchObject({ experimentId: "experiment-1", status: "completed" });
        expect(result.variants).toEqual([
            { variantId: "variant-1", name: "baseline", succeeded: 1, meanScore: 1, totalCostUsd: 0.01 },
        ]);
    });

    it("성공한 실행이 없으면 평균 점수를 비운다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment());
        repository.variants.push(aVariant());
        repository.executions.push(anExecution({ status: "failed" }));

        const result = await new GetExperimentComparisonUseCase(repository).execute("user-1", "experiment-1");

        expect(result.variants[0]).toMatchObject({ succeeded: 0, meanScore: null, totalCostUsd: 0 });
    });

    it("남의 실험은 비교하지 않는다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment());

        await expect(new GetExperimentComparisonUseCase(repository).execute("user-2", "experiment-1"))
            .rejects.toThrow();
    });
});
