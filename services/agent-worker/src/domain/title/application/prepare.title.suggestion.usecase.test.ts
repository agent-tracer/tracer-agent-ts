import { describe, expect, it } from "vitest";
import { TITLE_SETTING_KEY } from "~agent-worker/domain/title/model/title.const.js";
import {
    JobAlreadySettledError,
    JobNotFoundError,
    MissingApiKeyError,
    TaskHasNoEventsError,
    TaskNotFoundError,
} from "~agent-worker/domain/title/model/title.error.js";
import type { TitleAgentPort } from "~agent-worker/domain/title/port/title.agent.port.js";
import {
    CapturingTitleNotification,
    FixedClock,
    InMemoryTitleRepository,
    StubPromptSource,
    titleAgentOutput,
} from "~agent-worker/domain/title/port/__fakes__/title.test-support.js";
import { PrepareTitleSuggestionUsecase } from "./prepare.title.suggestion.usecase.js";

function agent(needsKey: boolean): TitleAgentPort {
    return {
        requiresLocalApiKey: () => needsKey,
        generate: async () => titleAgentOutput(),
    };
}

function setup(needsKey = false) {
    const repository = new InMemoryTitleRepository();
    const notification = new CapturingTitleNotification();
    return {
        repository,
        notification,
        usecase: new PrepareTitleSuggestionUsecase(
            repository,
            agent(needsKey),
            notification,
            new FixedClock(),
            new StubPromptSource(),
        ),
    };
}

describe("PrepareTitleSuggestionUsecase", () => {
    it("태스크 컨텍스트를 모아 실행 인자를 확정한다", async () => {
        const { usecase } = setup();

        const prep = await usecase.execute({ jobId: "job-1", taskId: "task-1" });

        expect(prep).toMatchObject({ jobId: "job-1", userId: "user-1", taskId: "task-1" });
        expect(prep.currentTitle).toBe("Task 1");
    });

    it("설정에 출력 언어가 없으면 auto로 실행한다", async () => {
        const { usecase } = setup();

        expect((await usecase.execute({ jobId: "job-1", taskId: "task-1" })).language).toBe("auto");
    });

    it("설정이 정한 출력 언어를 고정값에 싣는다", async () => {
        const { repository, usecase } = setup();
        repository.settings.set(`user-1/${TITLE_SETTING_KEY.outputLanguage}`, "ko");

        const prep = await usecase.execute({ jobId: "job-1", taskId: "task-1" });

        expect(prep.language).toBe("ko");
        expect(prep.prompt.promptVersion).toBe("v0.0.1");
    });

    it("설정이 고른 모델을 고정값에 싣는다", async () => {
        const { repository, usecase } = setup();
        repository.settings.set(`user-1/${TITLE_SETTING_KEY.anthropicModel}`, "claude-sonnet-5");

        const prep = await usecase.execute({ jobId: "job-1", taskId: "task-1" });

        expect(prep.model).toBe("claude-sonnet-5");
    });

    it("단가표가 모르는 모델 설정은 싣지 않는다", async () => {
        const { repository, usecase } = setup();
        repository.settings.set(`user-1/${TITLE_SETTING_KEY.anthropicModel}`, "gpt-9");

        const prep = await usecase.execute({ jobId: "job-1", taskId: "task-1" });

        expect(prep.model).toBeUndefined();
    });

    it("잡을 실행 상태로 올렸음을 알린다", async () => {
        const { notification, usecase } = setup();

        await usecase.execute({ jobId: "job-1", taskId: "task-1" });

        expect(notification.sent[0]?.payload).toMatchObject({ jobId: "job-1", status: "running" });
    });

    it("원장에 없는 잡은 찾지 못한 것으로 본다", async () => {
        const { repository, usecase } = setup();
        repository.job = null;

        await expect(usecase.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toBeInstanceOf(
            JobNotFoundError,
        );
    });

    it("남의 태스크는 찾지 못한 것으로 본다", async () => {
        const { repository, usecase } = setup();
        repository.taskContext = { ownedByUser: false, totalEventCount: 1, context: null };

        await expect(usecase.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toBeInstanceOf(
            TaskNotFoundError,
        );
    });

    it("근거 이벤트가 없는 태스크는 제목을 짓지 않는다", async () => {
        const { repository, usecase } = setup();
        repository.taskContext = { ownedByUser: true, totalEventCount: 0, context: null };

        await expect(usecase.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toBeInstanceOf(
            TaskNotFoundError,
        );
    });

    it("컨텍스트는 있는데 이벤트 수가 0이면 근거 없음으로 거절한다", async () => {
        const { repository, usecase } = setup();
        repository.taskContext = {
            ownedByUser: true,
            totalEventCount: 0,
            context: repository.taskContext!.context,
        };

        await expect(usecase.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toBeInstanceOf(
            TaskHasNoEventsError,
        );
    });

    it("이미 종결된 잡은 다시 시작하지 않는다", async () => {
        const { repository, usecase } = setup();
        repository.startable = false;

        await expect(usecase.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toBeInstanceOf(
            JobAlreadySettledError,
        );
    });

    it("러너가 자격을 요구하는데 설정에 키가 없으면 거절한다", async () => {
        const { usecase } = setup(true);

        await expect(usecase.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toBeInstanceOf(
            MissingApiKeyError,
        );
    });
});
