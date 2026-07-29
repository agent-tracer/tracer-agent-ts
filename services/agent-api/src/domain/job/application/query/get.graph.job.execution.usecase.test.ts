import { describe, expect, it } from "vitest";
import { graphJobExecution } from "~agent-api/domain/job/port/__fakes__/graph.job.execution.fixture.js";
import { InMemoryGraphJobExecutionReader } from "~agent-api/domain/job/port/__fakes__/in-memory.graph.job.execution.reader.js";
import { GetGraphJobExecutionUseCase } from "./get.graph.job.execution.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): GetGraphJobExecutionUseCase {
    const executions = new InMemoryGraphJobExecutionReader();
    executions.seed(graphJobExecution({
        id: "exec-1", userId: "local", kind: "recipe-scan", status: "queued", createdAt: NOW,
    }));
    return new GetGraphJobExecutionUseCase(executions);
}

describe("GetGraphJobExecutionUseCase", () => {
    it("실행 원장의 상태를 그 원장의 어휘 그대로 준다", async () => {
        const execution = await makeUseCase().execute("local", "exec-1");

        expect(execution).toMatchObject({ id: "exec-1", kind: "recipe-scan", status: "queued", budgetUsd: 2 });
    });

    it("남의 실행은 존재 여부도 드러내지 않는다", async () => {
        expect(await makeUseCase().execute("other", "exec-1")).toBeNull();
    });

    it("없는 실행은 비운다", async () => {
        expect(await makeUseCase().execute("local", "없음")).toBeNull();
    });
});
