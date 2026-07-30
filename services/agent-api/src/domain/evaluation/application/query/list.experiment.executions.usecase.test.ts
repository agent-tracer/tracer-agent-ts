import { describe, expect, it } from "vitest";
import { aScore, anExecution, anExperiment, experimentHarness } from "../experiment.test.fixture.js";
import { ListExperimentExecutionsUseCase } from "./list.experiment.executions.usecase.js";

describe("ListExperimentExecutionsUseCase", () => {
    it("실행마다 그 실행의 점수만 묶어 낸다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment());
        repository.executions.push(anExecution(), anExecution({ id: "execution-2" }));
        repository.scores.push(aScore(), aScore({ id: "score-2", executionId: "execution-2" }));

        const result = await new ListExperimentExecutionsUseCase(repository).execute("user-1", "experiment-1");

        expect(result.executions.map((row) => [row.execution.id, row.scores.map((score) => score.id)]))
            .toEqual([["execution-1", ["score-1"]], ["execution-2", ["score-2"]]]);
    });

    it("점수가 아직 없는 실행은 빈 점수 목록으로 낸다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment());
        repository.executions.push(anExecution());

        const result = await new ListExperimentExecutionsUseCase(repository).execute("user-1", "experiment-1");

        expect(result.executions[0]?.scores).toEqual([]);
    });

    it("남의 실험의 실행은 조회하지 않는다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment());

        await expect(new ListExperimentExecutionsUseCase(repository).execute("user-2", "experiment-1"))
            .rejects.toThrow();
    });
});
