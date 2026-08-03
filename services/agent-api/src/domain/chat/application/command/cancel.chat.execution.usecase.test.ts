import { describe, expect, it } from "vitest";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { FixedClock } from "~agent-api/domain/chat/port/__fakes__/fixed.clock.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { RecordingChatExecutionDispatcher } from "~agent-api/domain/chat/port/__fakes__/recording.chat.execution.dispatcher.js";
import { RecordingChatExecutionUpdates } from "~agent-api/domain/chat/port/__fakes__/recording.chat.execution.updates.js";
import { CancelChatExecutionUseCase } from "./cancel.chat.execution.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): {
    useCase: CancelChatExecutionUseCase;
    dispatcher: RecordingChatExecutionDispatcher;
    updates: RecordingChatExecutionUpdates;
} {
    const threads = new InMemoryChatThreadRepository();
    threads.seed(ChatThread.create({ id: "t1", userId: "local", title: "첫 대화", now: NOW }));
    const executions = new InMemoryChatExecutionRepository();
    executions.seed(ChatExecution.create({
        id: "e1",
        userId: "local",
        threadId: "t1",
        replayAnchorMessageId: "m1",
        clientRequestId: "r1",
        inputHash: "h",
        model: null,
        language: null,
        now: NOW,
    }));
    const dispatcher = new RecordingChatExecutionDispatcher();
    const updates = new RecordingChatExecutionUpdates();
    return {
        useCase: new CancelChatExecutionUseCase(threads, executions, dispatcher, new FixedClock(NOW), updates),
        dispatcher,
        updates,
    };
}

describe("CancelChatExecutionUseCase", () => {
    it("워크플로를 중단하고 실행을 취소로 적는다", async () => {
        const { useCase, dispatcher } = makeUseCase();

        const { execution } = await useCase.execute("local", "t1", "e1");

        expect(execution.status).toBe("canceled");
        expect(dispatcher.canceled).toEqual(["e1"]);
    });

    it("상태가 바뀌면 열린 연결을 깨운다", async () => {
        const { useCase, updates } = makeUseCase();

        await useCase.execute("local", "t1", "e1");

        expect(updates.published).toEqual(["e1"]);
    });

    it("이미 종결된 실행은 다시 깨우지 않는다", async () => {
        const { useCase, updates } = makeUseCase();
        await useCase.execute("local", "t1", "e1");
        updates.published.length = 0;

        await useCase.execute("local", "t1", "e1");

        expect(updates.published).toEqual([]);
    });

    it("남의 실행은 존재 자체를 알리지 않는다", async () => {
        const { useCase } = makeUseCase();

        await expect(useCase.execute("other", "t1", "e1")).rejects.toThrow("Chat execution not found");
    });
});
