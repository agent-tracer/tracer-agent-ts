import { describe, expect, it } from "vitest";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { FixedClock } from "~agent-api/domain/chat/port/__fakes__/fixed.clock.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { RenameThreadUseCase } from "./rename.thread.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const LATER = new Date("2026-01-02T00:00:00.000Z");

function seededThreads(): InMemoryChatThreadRepository {
    const threads = new InMemoryChatThreadRepository();
    threads.seed(ChatThread.create({ id: "t1", userId: "local", title: "첫 대화", now: NOW }));
    return threads;
}

describe("RenameThreadUseCase", () => {
    it("소유한 스레드의 제목을 바꾸고 갱신 시각을 민다", async () => {
        const threads = seededThreads();
        const useCase = new RenameThreadUseCase(threads, new FixedClock(LATER));

        const { thread } = await useCase.execute({ userId: "local", threadId: "t1", title: "새 제목" });

        expect(thread.title).toBe("새 제목");
        expect(thread.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    });

    it("남의 스레드는 존재 자체를 알리지 않는다", async () => {
        const useCase = new RenameThreadUseCase(seededThreads(), new FixedClock(LATER));

        await expect(useCase.execute({ userId: "other", threadId: "t1", title: "새 제목" }))
            .rejects.toThrow("Thread not found");
    });

    it("없는 스레드를 거절한다", async () => {
        const useCase = new RenameThreadUseCase(seededThreads(), new FixedClock(LATER));

        await expect(useCase.execute({ userId: "local", threadId: "없음", title: "새 제목" }))
            .rejects.toThrow("Thread not found");
    });
});
