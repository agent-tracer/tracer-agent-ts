import { describe, expect, it } from "vitest";
import { CHAT_MESSAGE_ROLE } from "~agent-api/domain/chat/model/chat.const.js";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { ChatMessage } from "~agent-api/domain/chat/model/chat.message.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { ChatUserMemory } from "~agent-api/domain/chat/model/chat.user.memory.model.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatMessageRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { InMemoryChatUserMemoryRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.user.memory.repository.js";
import { GetChatReplayUseCase } from "./get.chat.replay.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function at(seconds: number): Date {
    return new Date(NOW.getTime() + seconds * 1000);
}

function makeUseCase(): GetChatReplayUseCase {
    const threads = new InMemoryChatThreadRepository();
    threads.seed(ChatThread.create({ id: "t1", userId: "local", title: "첫 대화", now: NOW }));
    const executions = new InMemoryChatExecutionRepository();
    executions.seed(ChatExecution.create({
        id: "e1",
        userId: "local",
        threadId: "t1",
        userMessageId: "m3",
        clientRequestId: "r1",
        inputHash: "h",
        model: null,
        language: null,
        now: NOW,
    }));
    const messages = new InMemoryChatMessageRepository();
    messages.seed(
        ChatMessage.create({ id: "m1", threadId: "t1", role: CHAT_MESSAGE_ROLE.user, content: "안녕", now: at(0) }),
        ChatMessage.create({ id: "m2", threadId: "t1", role: CHAT_MESSAGE_ROLE.assistant, content: "네", now: at(1) }),
        ChatMessage.create({ id: "m3", threadId: "t1", role: CHAT_MESSAGE_ROLE.user, content: "이어서", now: at(2) }),
        ChatMessage.create({ id: "m4", threadId: "t1", role: CHAT_MESSAGE_ROLE.assistant, content: "아직 이력이 아니다", now: at(3) }),
    );
    const memories = new InMemoryChatUserMemoryRepository();
    memories.seed(ChatUserMemory.create({ id: "1", userId: "local", key: "editor", content: "vim", now: NOW }));
    return new GetChatReplayUseCase(executions, threads, messages, memories);
}

describe("GetChatReplayUseCase", () => {
    it("이번 턴의 사용자 메시지까지만 이력으로 준다", async () => {
        const replay = await makeUseCase().execute("local", "t1", "e1");

        expect(replay.messages.map((message) => message.content)).toEqual(["안녕", "네", "이어서"]);
    });

    it("이 사용자의 기억을 함께 준다", async () => {
        const replay = await makeUseCase().execute("local", "t1", "e1");

        expect(replay.facts).toEqual([{ key: "editor", content: "vim" }]);
    });

    it("남의 실행은 존재 자체를 알리지 않는다", async () => {
        await expect(makeUseCase().execute("other", "t1", "e1"))
            .rejects.toThrow("Chat execution not found");
    });
});
