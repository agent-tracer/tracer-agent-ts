import { describe, expect, it } from "vitest";
import { CHAT_MESSAGE_ROLE } from "~agent-api/domain/chat/model/chat.const.js";
import { ChatMessage } from "~agent-api/domain/chat/model/chat.message.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { InMemoryChatMessageRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { GetMessagesUseCase } from "./get.messages.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): GetMessagesUseCase {
    const threads = new InMemoryChatThreadRepository();
    threads.seed(ChatThread.create({ id: "t1", userId: "local", title: "첫 대화", now: NOW }));
    const messages = new InMemoryChatMessageRepository();
    messages.seed(
        ChatMessage.create({ id: "m2", threadId: "t1", role: CHAT_MESSAGE_ROLE.assistant, content: "네", now: new Date("2026-01-01T00:00:01.000Z") }),
        ChatMessage.create({ id: "m1", threadId: "t1", role: CHAT_MESSAGE_ROLE.user, content: "안녕", now: NOW }),
    );
    return new GetMessagesUseCase(threads, messages);
}

describe("GetMessagesUseCase", () => {
    it("스레드의 메시지를 쌓인 순서대로 준다", async () => {
        const { items } = await makeUseCase().execute("local", "t1");

        expect(items.map((item) => item.id)).toEqual(["m1", "m2"]);
    });

    it("남의 스레드는 존재 자체를 알리지 않는다", async () => {
        await expect(makeUseCase().execute("other", "t1")).rejects.toThrow("Thread not found");
    });
});
