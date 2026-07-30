import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JOB_KIND, JOB_KINDS } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import type { JobStep } from "~agent-api/domain/job/model/job.step.model.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { InMemoryJobStepRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.step.repository.js";
import { GetJobStepsUseCase } from "./get.job.steps.usecase.js";
import { GetJobUseCase } from "./get.job.usecase.js";
import { GetLatestJobUseCase } from "./get.latest.job.usecase.js";
import { ListJobHistoryUseCase } from "./list.job.history.usecase.js";
import { ListPendingJobsUseCase } from "./list.pending.jobs.usecase.js";

interface Window {
    readonly path: string;
    readonly status: number;
    readonly data?: Readonly<Record<string, string>>;
}

interface JobCase {
    readonly response: {
        readonly jobFields: readonly string[];
        readonly ledgerKinds: readonly string[];
        readonly get: Window;
        readonly pending: Window;
        readonly history: Window;
        readonly latest: Window;
        readonly steps: {
            readonly required: readonly string[];
            readonly optional: readonly string[];
            readonly omitsNull: boolean;
        };
    };
}

const CONTRACT_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../../../../contract",
);

const { response } = JSON.parse(
    readFileSync(path.join(CONTRACT_ROOT, "conformance/cases/job.intake.json"), "utf8"),
) as JobCase;

const NOW = new Date("2026-01-01T00:00:00.000Z");

function at(day: number): Date {
    return new Date(`2026-01-0${day}T00:00:00.000Z`);
}

function jobs(): InMemoryJobRepository {
    const repository = new InMemoryJobRepository();
    repository.seed(
        Job.create("job-1", "local", JOB_KIND.recipeScan, { taskId: "task-1" }, at(1)),
        Job.create("job-2", "local", JOB_KIND.recipeScan, { taskId: "task-2" }, at(2)),
    );
    return repository;
}

function step(overrides: Partial<JobStep>): JobStep {
    return {
        id: "s1", jobId: "job-1", userId: "local", attempt: 1, seq: 0, role: "assistant",
        content: "생각", truncated: false, toolCalls: null, toolName: null, toolCallId: null,
        inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheCreationTokens: null,
        stopReason: null, nodeName: null, eventKind: null, durationMs: null, createdAt: NOW,
        ...overrides,
    };
}

function filled(): JobStep {
    return step({
        id: "s2", seq: 1,
        toolCalls: [], toolName: "search_recipes", toolCallId: "c1", inputTokens: 1, outputTokens: 2,
        cacheReadTokens: 3, cacheCreationTokens: 4, stopReason: "end_turn", nodeName: "plan",
        eventKind: "node.completed", durationMs: 12,
    });
}

describe("잡 조회 표면", () => {
    it("원장에 남을 수 있는 잡 종류를 계약과 같게 안다", () => {
        expect(JOB_KINDS).toEqual(response.ledgerKinds);
    });

    it("상세 창구가 계약이 적은 칸으로 봉투를 채운다", async () => {
        const job = await new GetJobUseCase(jobs()).execute("local", "job-1");

        expect(Object.keys({ job })).toEqual(Object.keys(response.get.data ?? {}));
        expect(Object.keys(job ?? {})).toEqual(response.jobFields);
    });

    it("대기 창구가 계약이 적은 칸으로 봉투를 채운다", async () => {
        const page = await new ListPendingJobsUseCase(jobs()).execute("local", JOB_KIND.recipeScan);

        expect(Object.keys(page)).toEqual(Object.keys(response.pending.data ?? {}));
        expect(Object.keys(page.items[0] ?? {})).toEqual(response.jobFields);
    });

    it("이력 창구가 계약이 적은 칸으로 봉투를 채운다", async () => {
        const page = await new ListJobHistoryUseCase(jobs()).execute("local", { limit: 50, offset: 0 });

        expect(Object.keys(page)).toEqual(Object.keys(response.history.data ?? {}));
        expect(Object.keys(page.items[0] ?? {})).toEqual(response.jobFields);
    });

    it("최근 창구가 계약이 적은 칸으로 봉투를 채우고 없으면 비운다", async () => {
        const found = await new GetLatestJobUseCase(jobs()).execute("local", JOB_KIND.recipeScan);
        const missing = await new GetLatestJobUseCase(jobs()).execute("local", JOB_KIND.taskCleanup);

        expect(Object.keys(found)).toEqual(Object.keys(response.latest.data ?? {}));
        expect(Object.keys(found.job ?? {})).toEqual(response.jobFields);
        expect(missing.job).toBeNull();
    });

    it("궤적 한 줄이 계약이 요구하는 칸을 갖고 값이 없는 칸은 싣지 않는다", async () => {
        const steps = new InMemoryJobStepRepository();
        steps.seed(step({}), filled());
        const rows = await new GetJobStepsUseCase(jobs(), steps).execute("local", "job-1");

        expect(Object.keys(rows?.[0] ?? {})).toEqual(response.steps.required);
        expect(Object.keys(rows?.[1] ?? {}).sort())
            .toEqual([...response.steps.required, ...response.steps.optional].sort());
    });
});
