import { describe, expect, it } from "vitest";
import {
    CapturingTitleNotification,
    FixedClock,
    InMemoryTitleRepository,
} from "~agent-worker/domain/title/port/__fakes__/title.test-support.js";
import { FailTitleJobUsecase } from "./fail.title.job.usecase.js";

function setup() {
    const repository = new InMemoryTitleRepository();
    const notification = new CapturingTitleNotification();
    return {
        repository,
        notification,
        usecase: new FailTitleJobUsecase(repository, notification, new FixedClock()),
    };
}

describe("FailTitleJobUsecase", () => {
    it("잡을 실패로 닫고 사유를 알린다", async () => {
        const { notification, usecase } = setup();

        await usecase.execute({ jobId: "job-1", message: "boom" });

        expect(notification.sent[0]?.payload).toMatchObject({
            jobId: "job-1",
            status: "failed",
            error: "boom",
        });
    });

    it("긴 사유는 알림에 실을 길이로 자른다", async () => {
        const { notification, usecase } = setup();

        await usecase.execute({ jobId: "job-1", message: "가".repeat(500) });

        const error = notification.sent[0]?.payload["error"];
        expect(typeof error === "string" && error.endsWith("...")).toBe(true);
    });

    it("종결이 다른 실행에 밀리면 알리지 않는다", async () => {
        const { repository, notification, usecase } = setup();
        repository.transitionLost = true;

        await usecase.execute({ jobId: "job-1", message: "boom" });

        expect(notification.sent).toEqual([]);
    });
});
