import { describe, expect, it } from "vitest";
import { CHAT_MESSAGE_ROLE } from "~agent-api/domain/chat/model/chat.const.js";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { ChatMessage } from "~agent-api/domain/chat/model/chat.message.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatMessageRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatPendingToolRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { inMemoryChatTransaction } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.transaction.js";
import { RecordingChatExecutionDispatcher } from "~agent-api/domain/chat/port/__fakes__/recording.chat.execution.dispatcher.js";
import { DeleteThreadUseCase } from "./delete.thread.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): {
    useCase: DeleteThreadUseCase;
    threads: InMemoryChatThreadRepository;
    messages: InMemoryChatMessageRepository;
    dispatcher: RecordingChatExecutionDispatcher;
} {
    const threads = new InMemoryChatThreadRepository();
    threads.seed(ChatThread.create({ id: "t1", userId: "local", title: "첫 대화", now: NOW }));
    const messages = new InMemoryChatMessageRepository();
    messages.seed(ChatMessage.create({ id: "m1", threadId: "t1", role: CHAT_MESSAGE_ROLE.user, content: "안녕", now: NOW }));
    const executions = new InMemoryChatExecutionRepository();
    executions.seed(ChatExecution.create({
        id: "e1",
        userId: "local",
        threadId: "t1",
        userMessageId: "m1",
        clientRequestId: "r1",
        inputHash: "h",
        model: null,
        language: null,
        now: NOW,
    }));
    const dispatcher = new RecordingChatExecutionDispatcher();
    const transaction = inMemoryChatTransaction({
        executions,
        messages,
        pendingTools: new InMemoryChatPendingToolRepository(),
        threads,
    });
    return {
        useCase: new DeleteThreadUseCase(threads, executions, dispatcher, transaction),
        threads,
        messages,
        dispatcher,
    };
}

describe("DeleteThreadUseCase", () => {
    it("스레드와 그 메시지를 함께 지운다", async () => {
        const { useCase, threads, messages } = makeUseCase();

        await expect(useCase.execute("local", "t1")).resolves.toEqual({ deleted: true });
        expect(await threads.findById("t1")).toBeNull();
        expect(await messages.listByThread("t1")).toEqual([]);
    });

    it("아직 끝나지 않은 실행을 먼저 중단한다", async () => {
        const { useCase, dispatcher } = makeUseCase();

        await useCase.execute("local", "t1");

        expect(dispatcher.canceled).toEqual(["e1"]);
    });

    it("남의 스레드는 지우지 않는다", async () => {
        const { useCase, threads } = makeUseCase();

        await expect(useCase.execute("other", "t1")).rejects.toThrow("Thread not found");
        expect(await threads.findById("t1")).not.toBeNull();
    });
});
