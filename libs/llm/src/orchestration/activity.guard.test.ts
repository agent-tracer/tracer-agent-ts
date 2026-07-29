import { asyncLocalStorage, type Context } from "@temporalio/activity";
import { describe, expect, it } from "vitest";
import { AgentExecutionFailure } from "~llm/model/agent.error.js";
import { guardActivity } from "./activity.guard.js";

const never = (): boolean => false;

function inActivity<T>(run: () => Promise<T>): Promise<T> {
    return asyncLocalStorage.run({ info: { attempt: 2 } } as Context, run);
}

describe("guardActivity", () => {
    it("성공한 활동의 결과를 그대로 돌려준다", async () => {
        const guarded = await inActivity(() =>
            guardActivity({ activity: "prepare", jobId: "job-1", isNonRetryable: never }, () => Promise.resolve(7)),
        );

        expect(guarded).toBe(7);
    });

    it("도메인이 다시 태워도 소용없다고 판정한 실패는 재시도하지 않는다", async () => {
        const failure = inActivity(() =>
            guardActivity(
                {
                    activity: "generate",
                    jobId: "job-1",
                    isNonRetryable: (error) => error.name === "MissingApiKeyError",
                },
                () => Promise.reject(Object.assign(new Error("no key"), { name: "MissingApiKeyError" })),
            ),
        );

        await expect(failure).rejects.toMatchObject({ nonRetryable: true, type: "MissingApiKeyError" });
    });

    it("공급자가 알려 온 대기 시간을 다음 시도의 간격으로 옮긴다", async () => {
        const rateLimited = new AgentExecutionFailure("agent", "AGENT_FAILED", "slow down", {
            errorSubtype: "rate_limit_error",
            retryAfterMs: 30_000,
        });

        const failure = inActivity(() =>
            guardActivity({ activity: "generate", jobId: "job-1", isNonRetryable: never }, () =>
                Promise.reject(rateLimited),
            ),
        );

        await expect(failure).rejects.toMatchObject({ nonRetryable: false, nextRetryDelay: 30_000 });
    });

    it("판정이 없는 실패는 엔진이 재시도하도록 원형 그대로 올린다", async () => {
        const raw = new Error("boom");
        const failure = inActivity(() =>
            guardActivity({ activity: "finalize", jobId: "job-1", isNonRetryable: never }, () => Promise.reject(raw)),
        );

        await expect(failure).rejects.toBe(raw);
    });
});
