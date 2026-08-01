import { describe, expect, it } from "vitest";
import { requiredJobNotificationFields } from "~agent-worker/support/contract.js";
import { OUTPUT_LANGUAGE } from "~agent-worker/support/output.language.js";
import { JOB_STATUS } from "~agent-worker/support/job.const.js";
import { CLEANUP_SETTING_KEY } from "../model/cleanup.const.js";
import {
    CapturingCleanupNotification,
    emptyOutput,
    FakeCleanupAgent,
    fixedClock,
    InMemoryCleanupRepository,
    seedRepository,
    StubPromptSource,
} from "../port/__fakes__/cleanup.test-support.js";
import { PrepareTaskCleanupUsecase } from "./prepare.task.cleanup.usecase.js";

function usecase(repository: InMemoryCleanupRepository) {
    const notification = new CapturingCleanupNotification();
    const target = new PrepareTaskCleanupUsecase(
        repository,
        new FakeCleanupAgent(emptyOutput()),
        notification,
        fixedClock,
        new StubPromptSource(),
    );
    return { target, notification };
}

describe("PrepareTaskCleanupUsecase", () => {
    it("잡을 실행 상태로 올리고 결정론적으로 후보를 계산한다", async () => {
        const repository = seedRepository();
        const { target, notification } = usecase(repository);

        const prepared = await target.execute({ jobId: "job-1" });

        expect(prepared).toMatchObject({ jobId: "job-1", userId: "user-1", tasksScanned: 2 });
        expect(prepared.candidates.map((candidate) => candidate.id)).toEqual(["task-1"]);
        expect(repository.started).toEqual(["job-1"]);
        expect(notification.published[0]?.payload["status"]).toBe(JOB_STATUS.running);
        expect(Object.keys(notification.published[0]?.payload ?? {})).toEqual(
            expect.arrayContaining(requiredJobNotificationFields()),
        );
    });

    it("지원하지 않는 출력 언어는 auto로 정규화한다", async () => {
        const repository = seedRepository();
        repository.settings.set(CLEANUP_SETTING_KEY.outputLanguage, "kr");

        const prepared = await usecase(repository).target.execute({ jobId: "job-1" });

        expect(prepared.language).toBe(OUTPUT_LANGUAGE.auto);
    });

    it("잡을 찾을 수 없으면 실행하지 않는다", async () => {
        await expect(usecase(new InMemoryCleanupRepository()).target.execute({ jobId: "job-1" }))
            .rejects.toThrow("job not found: job-1");
    });

    it("자격 증명이 필요한 실행에 키가 없으면 실패한다", async () => {
        const repository = seedRepository();
        repository.settings.delete(CLEANUP_SETTING_KEY.anthropicApiKey);

        await expect(usecase(repository).target.execute({ jobId: "job-1" }))
            .rejects.toThrow("No LLM API key configured");
    });

    it("다른 전이가 잡을 종결하면 다시 시작하지 않는다", async () => {
        const repository = seedRepository();
        repository.startWins = false;

        await expect(usecase(repository).target.execute({ jobId: "job-1" }))
            .rejects.toThrow("job already settled by another transition: job-1");
    });

    it("요청한 상한을 범위 안으로 자른다", async () => {
        const repository = seedRepository();

        const prepared = await usecase(repository).target.execute({ jobId: "job-1", maxSuggestions: 999 });

        expect(prepared.maxSuggestions).toBe(50);
    });

    it("설정에 저장된 상한을 읽는다", async () => {
        const repository = seedRepository();
        repository.settings.set(CLEANUP_SETTING_KEY.maxSuggestions, "5");

        const prepared = await usecase(repository).target.execute({ jobId: "job-1" });

        expect(prepared.maxSuggestions).toBe(5);
    });
});
