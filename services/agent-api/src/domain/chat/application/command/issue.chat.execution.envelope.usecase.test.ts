import { describe, expect, it } from "vitest";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { FakeChatSettingReader } from "~agent-api/domain/chat/port/__fakes__/fake.chat.setting.reader.js";
import { FixedChatDraftToken } from "~agent-api/domain/chat/port/__fakes__/fixed.chat.draft.token.js";
import { FixedChatScopeToken } from "~agent-api/domain/chat/port/__fakes__/fixed.chat.scope.token.js";
import { FixedClock } from "~agent-api/domain/chat/port/__fakes__/fixed.clock.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { IssueChatExecutionEnvelopeUseCase } from "./issue.chat.execution.envelope.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(options: {
    readonly apiKey?: string | null;
    readonly scopeToken?: string | null;
    readonly model?: string | null;
} = {}): IssueChatExecutionEnvelopeUseCase {
    const executions = new InMemoryChatExecutionRepository();
    executions.seed(ChatExecution.create({
        id: "e1",
        userId: "local",
        threadId: "t1",
        userMessageId: "m1",
        clientRequestId: "r1",
        inputHash: "h",
        model: options.model ?? null,
        language: null,
        now: NOW,
    }));
    return new IssueChatExecutionEnvelopeUseCase(
        executions,
        new FakeChatSettingReader(options.apiKey === undefined ? "sk-test" : options.apiKey),
        new FixedChatDraftToken(),
        new FixedChatScopeToken(options.scopeToken === undefined ? "scope-token" : options.scopeToken),
        "http://tracer-api:3902",
        "http://agent-api:3904",
        new FixedClock(NOW),
    );
}

describe("IssueChatExecutionEnvelopeUseCase", () => {
    it("한 시도가 쓸 모델과 자격과 한도를 함께 낸다", async () => {
        const envelope = await makeUseCase().execute("e1");

        expect(envelope.model).toBe("claude-sonnet-4-6");
        expect(envelope.apiKey).toBe("sk-test");
        expect(envelope.limits.maxTurns).toBe(14);
        expect(envelope.scopeToken).toBe("scope-token");
    });

    it("접수가 고른 모델이 있으면 그것을 싣는다", async () => {
        const envelope = await makeUseCase({ model: "claude-opus-5" }).execute("e1");

        expect(envelope.model).toBe("claude-opus-5");
    });

    it("도구가 되읽을 기점과 통지가 되돌아올 기점을 나눠 싣는다", async () => {
        const envelope = await makeUseCase().execute("e1");

        expect(envelope.readApiBaseUrl).toBe("http://tracer-api:3902");
        expect(envelope.draft.url).toBe("http://agent-api:3904/api/v1/chat/executions/e1/drafts");
    });

    it("자격을 만들 수 없는 환경에서는 범위 자격을 비운다", async () => {
        const envelope = await makeUseCase({ scopeToken: null }).execute("e1");

        expect(envelope.scopeToken).toBe("");
    });

    it("모델 자격이 없으면 접수를 거절한다", async () => {
        await expect(makeUseCase({ apiKey: null }).execute("e1"))
            .rejects.toMatchObject({ code: "chat.llm-key-missing" });
    });

    it("없는 실행은 존재 자체를 알리지 않는다", async () => {
        await expect(makeUseCase().execute("없음")).rejects.toThrow("Chat execution not found");
    });
});
