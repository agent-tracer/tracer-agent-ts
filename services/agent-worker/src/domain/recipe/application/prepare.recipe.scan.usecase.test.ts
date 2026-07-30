import { describe, expect, it } from "vitest";
import { requiredJobNotificationFields } from "~agent-worker/support/contract.js";
import { OUTPUT_LANGUAGE } from "~agent-worker/support/output.language.js";
import { JOB_STATUS } from "~agent-worker/support/job.const.js";
import { RECIPE_SCAN_TRIGGER, RECIPE_SETTING_KEY } from "../model/recipe.const.js";
import {
    CapturingRecipeNotification,
    emptyOutput,
    FakeRecipeAgent,
    fixedClock,
    InMemoryRecipeRepository,
    seedRepository,
} from "../port/__fakes__/recipe.test-support.js";
import { PrepareRecipeScanUsecase } from "./prepare.recipe.scan.usecase.js";

function usecase(repository: InMemoryRecipeRepository) {
    const notification = new CapturingRecipeNotification();
    const target = new PrepareRecipeScanUsecase(
        repository,
        new FakeRecipeAgent(emptyOutput()),
        notification,
        fixedClock,
    );
    return { target, notification };
}

describe("PrepareRecipeScanUsecase", () => {
    it("잡을 실행 상태로 올리고 실행 인자를 확정한다", async () => {
        const repository = seedRepository();
        const { target, notification } = usecase(repository);

        const prepared = await target.execute({
            jobId: "job-1",
            taskId: "task-1",
            language: "ko",
        });

        expect(prepared).toMatchObject({
            jobId: "job-1",
            userId: "user-1",
            taskId: "task-1",
            language: OUTPUT_LANGUAGE.ko,
        });
        expect(repository.started).toEqual(["job-1"]);
        expect(notification.published[0]?.payload["status"]).toBe(JOB_STATUS.running);
        expect(Object.keys(notification.published[0]?.payload ?? {})).toEqual(
            expect.arrayContaining(requiredJobNotificationFields()),
        );
    });

    it("지원하지 않는 출력 언어는 auto로 정규화한다", async () => {
        const prepared = await usecase(seedRepository()).target.execute({
            jobId: "job-1",
            taskId: "task-1",
            language: "kr",
        });

        expect(prepared.language).toBe(OUTPUT_LANGUAGE.auto);
    });

    it("잡을 찾을 수 없으면 실행하지 않는다", async () => {
        await expect(usecase(new InMemoryRecipeRepository()).target.execute({
            jobId: "job-1",
            taskId: "task-1",
        })).rejects.toThrow("job not found: job-1");
    });

    it("세션 트리거는 세션 앵커 자격으로 판정한다", async () => {
        const repository = seedRepository();
        repository.anchors.set("task-1", {
            ownedByUser: true,
            scanEligible: false,
            sessionScanEligible: true,
        });
        const { target } = usecase(repository);

        await expect(target.execute({
            jobId: "job-1",
            taskId: "task-1",
            trigger: RECIPE_SCAN_TRIGGER.session,
        })).resolves.toMatchObject({ taskId: "task-1" });
        await expect(target.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toThrow(
            "task is not a recipe scan anchor: task-1",
        );
    });

    it("사용자 소유가 아닌 태스크는 앵커로 쓰지 않는다", async () => {
        const repository = seedRepository();
        repository.anchors.set("task-1", {
            ownedByUser: false,
            scanEligible: true,
            sessionScanEligible: true,
        });

        await expect(usecase(repository).target.execute({
            jobId: "job-1",
            taskId: "task-1",
        })).rejects.toThrow("task not found: task-1");
    });

    it("자격 증명이 필요한 실행에 키가 없으면 실패한다", async () => {
        const repository = seedRepository();
        repository.settings.delete(RECIPE_SETTING_KEY.anthropicApiKey);

        await expect(usecase(repository).target.execute({
            jobId: "job-1",
            taskId: "task-1",
        })).rejects.toThrow("No LLM API key configured");
    });

    it("다른 전이가 잡을 종결하면 다시 시작하지 않는다", async () => {
        const repository = seedRepository();
        repository.startWins = false;

        await expect(usecase(repository).target.execute({
            jobId: "job-1",
            taskId: "task-1",
        })).rejects.toThrow("job already settled by another transition: job-1");
    });
});
