import { describe, expect, it } from "vitest";
import { FixedClock } from "~agent-api/domain/chat/port/__fakes__/fixed.clock.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { SequentialChatIdGenerator } from "~agent-api/domain/chat/port/__fakes__/sequential.chat.id.generator.js";
import { CreateThreadUseCase } from "./create.thread.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("CreateThreadUseCase", () => {
    it("연 스레드를 소유자와 제목과 함께 적재한다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const useCase = new CreateThreadUseCase(threads, new FixedClock(NOW), new SequentialChatIdGenerator());

        const { thread } = await useCase.execute({ userId: "local", title: "첫 대화" });

        expect(thread).toMatchObject({ id: "chat-id-1", userId: "local", title: "첫 대화" });
        expect(await threads.findById("chat-id-1")).not.toBeNull();
    });

    it("연 시각을 만든 시각과 갱신 시각에 함께 적는다", async () => {
        const useCase = new CreateThreadUseCase(
            new InMemoryChatThreadRepository(),
            new FixedClock(NOW),
            new SequentialChatIdGenerator(),
        );

        const { thread } = await useCase.execute({ userId: "local", title: "첫 대화" });

        expect(thread.createdAt).toBe("2026-01-01T00:00:00.000Z");
        expect(thread.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    });
});
