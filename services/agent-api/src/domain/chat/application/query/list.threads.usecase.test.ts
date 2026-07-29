import { describe, expect, it } from "vitest";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { ListThreadsUseCase } from "./list.threads.usecase.js";

describe("ListThreadsUseCase", () => {
    it("이 사용자의 스레드만 최신순으로 준다", async () => {
        const threads = new InMemoryChatThreadRepository();
        threads.seed(
            ChatThread.create({ id: "t1", userId: "local", title: "오래된", now: new Date("2026-01-01T00:00:00.000Z") }),
            ChatThread.create({ id: "t2", userId: "local", title: "최근", now: new Date("2026-01-02T00:00:00.000Z") }),
            ChatThread.create({ id: "t3", userId: "other", title: "남의 것", now: new Date("2026-01-03T00:00:00.000Z") }),
        );

        const { items } = await new ListThreadsUseCase(threads).execute("local");

        expect(items.map((item) => item.id)).toEqual(["t2", "t1"]);
    });

    it("스레드가 없으면 빈 목록을 준다", async () => {
        const { items } = await new ListThreadsUseCase(new InMemoryChatThreadRepository()).execute("local");

        expect(items).toEqual([]);
    });
});
