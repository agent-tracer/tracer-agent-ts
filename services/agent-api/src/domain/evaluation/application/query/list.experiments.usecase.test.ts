import { describe, expect, it } from "vitest";
import { anExperiment, experimentHarness } from "../experiment.test.fixture.js";
import { ListExperimentsUseCase } from "./list.experiments.usecase.js";

describe("ListExperimentsUseCase", () => {
    it("자기 사용자의 실험만 목록의 칸에 담아 낸다", async () => {
        const { repository } = experimentHarness();
        repository.experiments.push(anExperiment(), anExperiment({ id: "experiment-2", userId: "user-2" }));

        const result = await new ListExperimentsUseCase(repository).execute("user-1");

        expect(result.experiments.map((row) => row.id)).toEqual(["experiment-1"]);
    });

    it("실험이 없으면 빈 목록을 낸다", async () => {
        const { repository } = experimentHarness();

        expect(await new ListExperimentsUseCase(repository).execute("user-1")).toEqual({ experiments: [] });
    });
});
