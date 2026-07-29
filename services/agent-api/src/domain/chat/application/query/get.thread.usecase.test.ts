import { describe, expect, it } from "vitest";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { GetThreadUseCase } from "./get.thread.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function seeded(): InMemoryChatThreadRepository {
    const threads = new InMemoryChatThreadRepository();
    threads.seed(ChatThread.create({ id: "t1", userId: "local", title: "첫 대화", now: NOW }));
    return threads;
}

describe("GetThreadUseCase", () => {
    it("소유한 스레드를 준다", async () => {
        const { thread } = await new GetThreadUseCase(seeded()).execute("local", "t1");

        expect(thread.title).toBe("첫 대화");
    });

    it("남의 스레드는 존재 자체를 알리지 않는다", async () => {
        await expect(new GetThreadUseCase(seeded()).execute("other", "t1"))
            .rejects.toThrow("Thread not found");
    });
});
