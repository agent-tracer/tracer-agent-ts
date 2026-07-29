import { describe, expect, it } from "vitest";
import {
    CapturingTitleNotification,
    FixedClock,
    InMemoryTitleRepository,
    titleObservation,
} from "~agent-worker/domain/title/port/__fakes__/title.test-support.js";
import { FinalizeTitleSuggestionUsecase } from "./finalize.title.suggestion.usecase.js";

function input(suggestionCount: number) {
    return {
        jobId: "job-1",
        userId: "user-1",
        output: {
            suggestions: Array.from({ length: suggestionCount }, (_unused, index) => ({
                title: `제목 ${index + 1}`,
                rationale: "근거",
            })),
            jobSteps: [],
            attempt: 1,
            modelUsed: "claude-haiku-4-5",
            durationMs: 10,
            costUsd: 0.01,
            numTurns: 1,
            usage: null,
            observation: titleObservation(),
        },
    };
}

function setup() {
    const repository = new InMemoryTitleRepository();
    const notification = new CapturingTitleNotification();
    return {
        repository,
        notification,
        usecase: new FinalizeTitleSuggestionUsecase(repository, notification, new FixedClock()),
    };
}

describe("FinalizeTitleSuggestionUsecase", () => {
    it("제안과 궤적을 한 커밋으로 새기고 완료를 알린다", async () => {
        const { repository, notification, usecase } = setup();

        await usecase.execute(input(2));

        expect(repository.committed?.suggestions).toHaveLength(2);
        expect(notification.sent[0]?.payload).toMatchObject({
            status: "completed",
            summary: "2 title suggestions",
        });
    });

    it("제안이 없으면 없다는 요약을 싣는다", async () => {
        const { notification, usecase } = setup();

        await usecase.execute(input(0));

        expect(notification.sent[0]?.payload).toMatchObject({
            summary: "No title alternatives produced",
        });
    });

    it("종결이 다른 실행에 밀리면 알리지 않는다", async () => {
        const { repository, notification, usecase } = setup();
        repository.transitionLost = true;

        await usecase.execute(input(2));

        expect(notification.sent).toEqual([]);
    });
});
