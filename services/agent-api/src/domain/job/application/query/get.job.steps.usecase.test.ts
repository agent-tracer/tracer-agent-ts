import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import type { JobStep } from "~agent-api/domain/job/model/job.step.model.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { InMemoryJobStepRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.step.repository.js";
import { GetJobStepsUseCase } from "./get.job.steps.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function step(overrides: Partial<JobStep>): JobStep {
    return {
        id: "s1",
        jobId: "job-1",
        userId: "local",
        attempt: 1,
        seq: 0,
        role: "assistant",
        content: "생각",
        truncated: false,
        toolCalls: null,
        toolName: null,
        toolCallId: null,
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheCreationTokens: null,
        stopReason: null,
        nodeName: null,
        eventKind: null,
        durationMs: null,
        createdAt: NOW,
        ...overrides,
    };
}

function makeUseCase(): GetJobStepsUseCase {
    const jobs = new InMemoryJobRepository();
    jobs.seed(Job.create("job-1", "local", JOB_KIND.recipeScan, { taskId: "task-1" }, NOW));
    const steps = new InMemoryJobStepRepository();
    steps.seed(
        step({ id: "s2", seq: 1, role: "tool", content: "결과", toolName: "search_recipes", durationMs: 12 }),
        step({ id: "s1", seq: 0 }),
    );
    return new GetJobStepsUseCase(jobs, steps);
}

describe("GetJobStepsUseCase", () => {
    it("잡 하나의 궤적을 순서대로 준다", async () => {
        const steps = await makeUseCase().execute("local", "job-1");

        expect(steps?.map((item) => item.seq)).toEqual([0, 1]);
    });

    it("값이 없는 자리는 싣지 않는다", async () => {
        const steps = await makeUseCase().execute("local", "job-1");

        expect(steps![0]).not.toHaveProperty("toolName");
        expect(steps![1]).toMatchObject({ toolName: "search_recipes", durationMs: 12 });
    });

    it("남의 잡은 존재 여부도 드러내지 않는다", async () => {
        expect(await makeUseCase().execute("other", "job-1")).toBeNull();
    });
});
