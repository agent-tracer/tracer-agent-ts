import { AGENT_BACKEND } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { FakeJobSettingReader } from "~agent-api/domain/job/port/__fakes__/fake.job.setting.reader.js";
import { FixedClock } from "~agent-api/domain/job/port/__fakes__/fixed.clock.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { InMemoryRuleAnchorReader } from "~agent-api/domain/job/port/__fakes__/in-memory.rule.anchor.reader.js";
import { InMemoryScanAnchorReader } from "~agent-api/domain/job/port/__fakes__/in-memory.scan.anchor.reader.js";
import { IneligibleScanAnchorError } from "~agent-api/domain/job/model/job.errors.js";
import type { ScanAnchor } from "~agent-api/domain/job/port/scan.anchor.reader.port.js";
import { RecordingJobEventLog } from "~agent-api/domain/job/port/__fakes__/recording.job.event.log.js";
import { RecordingWorkflowDispatcher } from "~agent-api/domain/job/port/__fakes__/recording.workflow.dispatcher.js";
import { SequentialJobIdGenerator } from "~agent-api/domain/job/port/__fakes__/sequential.job.id.generator.js";
import { EnqueueJobUseCase } from "./enqueue.job.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

interface Harness {
    readonly useCase: EnqueueJobUseCase;
    readonly jobs: InMemoryJobRepository;
    readonly dispatcher: RecordingWorkflowDispatcher;
    readonly jobLog: RecordingJobEventLog;
    readonly settings: FakeJobSettingReader;
}

function makeHarness(options: { readonly apiKey?: string | null; readonly localCliAuth?: boolean } = {}): Harness {
    const jobs = new InMemoryJobRepository();
    const dispatcher = new RecordingWorkflowDispatcher();
    const jobLog = new RecordingJobEventLog();
    const settings = new FakeJobSettingReader(options.apiKey === undefined ? "sk-test" : options.apiKey);
    const anchors = new InMemoryRuleAnchorReader();
    anchors.seed(
        "local",
        { id: "e1", taskId: "task-1", userMessage: true },
        { id: "e2", taskId: "task-1", userMessage: false },
    );
    const scanAnchors = new InMemoryScanAnchorReader();
    scanAnchors.seed(
        "local",
        { id: "task-1", origin: "user", root: true, status: "completed" },
        { id: "task-2", origin: "user", root: true, status: "completed" },
    );
    return {
        useCase: new EnqueueJobUseCase(
            jobs,
            anchors,
            scanAnchors,
            settings,
            dispatcher,
            new FixedClock(NOW),
            options.localCliAuth ?? false,
            jobLog,
            new SequentialJobIdGenerator(),
        ),
        jobs,
        dispatcher,
        jobLog,
        settings,
    };
}

describe("EnqueueJobUseCase", () => {
    it("워크플로가 도는 종류를 접수하고 실행을 기동한다", async () => {
        const { useCase, dispatcher } = makeHarness();

        const { job } = await useCase.execute("local", JOB_KIND.recipeScan, { taskId: "task-1" });

        expect(job).toMatchObject({ id: "job-id-1", kind: JOB_KIND.recipeScan, status: "pending", executor: "temporal" });
        expect(dispatcher.started).toEqual([{ kind: JOB_KIND.recipeScan, jobId: "job-id-1", input: { taskId: "task-1" } }]);
    });

    it("접수한 잡이 아직 대기 중이어도 원장에 이 접수구의 축을 갖는다", async () => {
        const { useCase, jobs } = makeHarness();

        const { job } = await useCase.execute("local", JOB_KIND.recipeScan, { taskId: "task-1" });
        const stored = await jobs.findById("job-id-1");

        expect(job.status).toBe("pending");
        expect(job.backend).toBe(AGENT_BACKEND);
        expect(stored?.backend).toBe(AGENT_BACKEND);
    });

    it("워크플로를 기동하지 않는 종류도 원장에 축을 갖는다", async () => {
        const { useCase } = makeHarness();

        const { job } = await useCase.execute("local", JOB_KIND.ruleGeneration, {
            taskId: "task-1",
            anchorEventId: "e1",
        });

        expect(job.backend).toBe(AGENT_BACKEND);
    });

    it("입력에 실린 태스크를 컬럼으로 올린다", async () => {
        const { useCase } = makeHarness();

        const { job } = await useCase.execute("local", JOB_KIND.recipeScan, { taskId: "task-1" });

        expect(job.taskId).toBe("task-1");
    });

    it("로컬 실행 종류는 워크플로를 기동하지 않는다", async () => {
        const { useCase, dispatcher } = makeHarness();

        const { job } = await useCase.execute("local", JOB_KIND.ruleGeneration, { taskId: "task-1", anchorEventId: "e1" });

        expect(job.executor).toBe("local");
        expect(dispatcher.started).toEqual([]);
    });

    it("모델 자격이 없으면 접수를 거절한다", async () => {
        const { useCase, jobLog } = makeHarness({ apiKey: null });

        await expect(useCase.execute("local", JOB_KIND.recipeScan, { taskId: "task-1" }))
            .rejects.toMatchObject({ code: "job.llm-key-missing" });
        expect(jobLog.keyMissing).toHaveLength(1);
    });

    it("로컬 자격으로 도는 이미지는 모델 자격을 묻지 않는다", async () => {
        const { useCase, settings } = makeHarness({ apiKey: null, localCliAuth: true });

        await expect(useCase.execute("local", JOB_KIND.recipeScan, { taskId: "task-1" })).resolves.toBeDefined();
        expect(settings.requested).toEqual([]);
    });

    it("규칙 생성은 모델 자격을 묻지 않는다", async () => {
        const { useCase, settings } = makeHarness({ apiKey: null });

        await expect(useCase.execute("local", JOB_KIND.ruleGeneration, { taskId: "task-1", anchorEventId: "e1" }))
            .resolves.toBeDefined();
        expect(settings.requested).toEqual([]);
    });

    it("남의 근거에 매달린 규칙 생성을 거절한다", async () => {
        const { useCase } = makeHarness();

        await expect(useCase.execute("other", JOB_KIND.ruleGeneration, { taskId: "task-1", anchorEventId: "e1" }))
            .rejects.toMatchObject({ code: "job.invalid-rule-anchor" });
    });

    it("사용자 발화가 아닌 근거를 거절한다", async () => {
        const { useCase } = makeHarness();

        await expect(useCase.execute("local", JOB_KIND.ruleGeneration, { taskId: "task-1", anchorEventId: "e2" }))
            .rejects.toMatchObject({ code: "job.invalid-rule-anchor" });
    });

    it("같은 멱등키와 같은 입력이면 접수를 하나로 접는다", async () => {
        const { useCase, jobs, jobLog } = makeHarness();
        const input = { taskId: "task-1" };

        const first = await useCase.execute("local", JOB_KIND.recipeScan, input, { idempotencyKey: "scan-1" });
        const second = await useCase.execute("local", JOB_KIND.recipeScan, input, { idempotencyKey: "scan-1" });

        expect(second.job.id).toBe(first.job.id);
        expect(jobs.all()).toHaveLength(1);
        expect(jobLog.enqueuedEntries).toHaveLength(1);
    });

    it("같은 멱등키로 다른 입력이 오면 거절한다", async () => {
        const { useCase, jobLog } = makeHarness();
        await useCase.execute("local", JOB_KIND.recipeScan, { taskId: "task-1" }, { idempotencyKey: "scan-1" });

        await expect(useCase.execute("local", JOB_KIND.recipeScan, { taskId: "task-2" }, { idempotencyKey: "scan-1" }))
            .rejects.toMatchObject({ code: "job.idempotency-conflict" });
        expect(jobLog.conflicts).toHaveLength(1);
    });

    it("키 순서가 달라도 같은 입력으로 본다", async () => {
        const { useCase, jobs } = makeHarness();

        await useCase.execute("local", JOB_KIND.recipeScan, { taskId: "task-1", language: "ko" }, { idempotencyKey: "scan-1" });
        await useCase.execute("local", JOB_KIND.recipeScan, { language: "ko", taskId: "task-1" }, { idempotencyKey: "scan-1" });

        expect(jobs.all()).toHaveLength(1);
    });
});

describe("스캔 앵커의 자격", () => {
    const ANCHOR: ScanAnchor = { id: "task-1", origin: "user", root: true, status: "completed" };

    async function enqueueScan(
        anchor: Partial<ScanAnchor> | null,
        input: Record<string, unknown> = {},
    ): Promise<{ readonly rejected: boolean }> {
        const scanAnchors = new InMemoryScanAnchorReader();
        if (anchor !== null) scanAnchors.seed("local", { ...ANCHOR, ...anchor });
        const useCase = new EnqueueJobUseCase(
            new InMemoryJobRepository(),
            new InMemoryRuleAnchorReader(),
            scanAnchors,
            new FakeJobSettingReader("sk-test"),
            new RecordingWorkflowDispatcher(),
            new FixedClock(NOW),
            false,
            new RecordingJobEventLog(),
            new SequentialJobIdGenerator(),
        );

        try {
            await useCase.execute("local", JOB_KIND.recipeScan, { taskId: "task-1", ...input });
            return { rejected: false };
        } catch (error) {
            expect(error).toBeInstanceOf(IneligibleScanAnchorError);
            return { rejected: true };
        }
    }

    it("자격을 갖춘 앵커는 접수한다", async () => {
        expect((await enqueueScan({})).rejected).toBe(false);
    });

    it("에이전트가 만든 태스크를 접수에서 거절한다", async () => {
        expect((await enqueueScan({ origin: "server-sdk" })).rejected).toBe(true);
    });

    it("부모가 있는 태스크를 접수에서 거절한다", async () => {
        expect((await enqueueScan({ root: false })).rejected).toBe(true);
    });

    it("아직 도는 태스크를 접수에서 거절한다", async () => {
        expect((await enqueueScan({ status: "running" })).rejected).toBe(true);
    });

    it("남의 태스크는 없는 것으로 보고 거절한다", async () => {
        expect((await enqueueScan(null)).rejected).toBe(true);
    });

    it("세션에서 부른 스캔은 아직 도는 태스크도 접수한다", async () => {
        const answered = await enqueueScan({ status: "running" }, { trigger: "session" });

        expect(answered.rejected).toBe(false);
    });
});
