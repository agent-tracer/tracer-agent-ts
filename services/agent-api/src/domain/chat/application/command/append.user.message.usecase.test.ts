import { describe, expect, it } from "vitest";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { FixedClock } from "~agent-api/domain/chat/port/__fakes__/fixed.clock.js";
import { InMemoryChatMessageRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { SequentialChatIdGenerator } from "~agent-api/domain/chat/port/__fakes__/sequential.chat.id.generator.js";
import { AppendUserMessageUseCase } from "./append.user.message.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): { useCase: AppendUserMessageUseCase; messages: InMemoryChatMessageRepository } {
    const threads = new InMemoryChatThreadRepository();
    threads.seed(ChatThread.create({ id: "t1", userId: "local", title: "첫 대화", now: NOW }));
    const messages = new InMemoryChatMessageRepository();
    return {
        useCase: new AppendUserMessageUseCase(
            threads,
            messages,
            new FixedClock(NOW),
            new SequentialChatIdGenerator(),
        ),
        messages,
    };
}

describe("AppendUserMessageUseCase", () => {
    it("사용자 발화를 스레드에 적재한다", async () => {
        const { useCase, messages } = makeUseCase();

        const { message } = await useCase.execute({ userId: "local", threadId: "t1", content: "안녕" });

        expect(message).toMatchObject({ threadId: "t1", role: "user", content: "안녕" });
        expect(await messages.listByThread("t1")).toHaveLength(1);
    });

    it("소유하지 않은 스레드에는 적재하지 않는다", async () => {
        const { useCase, messages } = makeUseCase();

        await expect(useCase.execute({ userId: "other", threadId: "t1", content: "안녕" }))
            .rejects.toThrow("Thread not found");
        expect(await messages.listByThread("t1")).toHaveLength(0);
    });
});
