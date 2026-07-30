import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { FakeJobSettingReader } from "~agent-api/domain/job/port/__fakes__/fake.job.setting.reader.js";
import { IssueJobExecutionEnvelopeUseCase } from "./issue.job.execution.envelope.usecase.js";

function makeUseCase(apiKey: string | null = "sk-test"): IssueJobExecutionEnvelopeUseCase {
    return new IssueJobExecutionEnvelopeUseCase(new FakeJobSettingReader(apiKey));
}

describe("IssueJobExecutionEnvelopeUseCase", () => {
    it("한 시도가 쓸 모델과 자격과 한도를 함께 낸다", async () => {
        const envelope = await makeUseCase().execute(JOB_KIND.recipeScan, "local");

        expect(envelope.model).toBe("claude-sonnet-4-6");
        expect(envelope.fallbackModel).toBe("claude-haiku-4-5");
        expect(envelope.apiKey).toBe("sk-test");
        expect(envelope.limits).toEqual({ budgetUsd: 2.0, maxTurns: 15, maxOutputTokens: 16000 });
        expect(envelope.deadlineMs).toBe(720000);
    });

    it("종류마다 그 기능의 모델과 한도를 낸다", async () => {
        const envelope = await makeUseCase().execute(JOB_KIND.titleSuggestion, "local");

        expect(envelope.model).toBe("claude-haiku-4-5");
        expect(envelope.limits.budgetUsd).toBe(0.2);
    });

    it("단가를 아는 모델의 백만 토큰당 단가를 함께 낸다", async () => {
        const envelope = await makeUseCase().execute(JOB_KIND.taskCleanup, "local");

        expect(envelope.modelRates["claude-haiku-4-5"]).toEqual({
            input: 1.0,
            output: 5.0,
            cacheWrite: 1.25,
            cacheRead: 0.1,
        });
    });

    it("사용자 설정에서 그 사용자의 자격만 찾는다", async () => {
        const settings = new FakeJobSettingReader("sk-test");
        await new IssueJobExecutionEnvelopeUseCase(settings).execute(JOB_KIND.taskCleanup, "alice");

        expect(settings.requested).toEqual([{ scope: "alice", key: "anthropic.api_key" }]);
    });

    it("모델 자격이 없으면 발급을 거절한다", async () => {
        await expect(makeUseCase(null).execute(JOB_KIND.recipeScan, "local"))
            .rejects.toMatchObject({ code: "job.llm-key-missing" });
    });
});
