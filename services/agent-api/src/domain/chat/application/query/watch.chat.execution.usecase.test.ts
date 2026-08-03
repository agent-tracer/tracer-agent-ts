import { describe, expect, it } from "vitest";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { ChatPendingTool } from "~agent-api/domain/chat/model/chat.pending.tool.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatPendingToolRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { RecordingChatExecutionUpdates } from "~agent-api/domain/chat/port/__fakes__/recording.chat.execution.updates.js";
import { WatchChatExecutionUseCase } from "./watch.chat.execution.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): { useCase: WatchChatExecutionUseCase; updates: RecordingChatExecutionUpdates } {
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
    const pendingTools = new InMemoryChatPendingToolRepository();
    pendingTools.seed(ChatPendingTool.create({
        id: "c1", threadId: "t1", messageId: null, toolName: "archive_task", args: {}, now: NOW,
    }));
    const updates = new RecordingChatExecutionUpdates();
    return { useCase: new WatchChatExecutionUseCase(threads, executions, pendingTools, updates), updates };
}

describe("WatchChatExecutionUseCase", () => {
    it("실행 상태와 대기 도구를 한 번에 낸다", async () => {
        const { useCase } = makeUseCase();

        const snapshot = await useCase.snapshot("local", "t1", "e1");

        expect(snapshot.execution.id).toBe("e1");
        expect(snapshot.confirmations.map((row) => row.id)).toEqual(["c1"]);
    });

    it("갱신이 오면 구독자를 깨운다", () => {
        const { useCase, updates } = makeUseCase();
        let woken = 0;

        useCase.subscribe("e1", () => { woken += 1; });
        updates.publish("e1");

        expect(woken).toBe(1);
    });

    it("구독을 풀면 더 깨우지 않는다", () => {
        const { useCase, updates } = makeUseCase();
        let woken = 0;

        const unsubscribe = useCase.subscribe("e1", () => { woken += 1; });
        unsubscribe();
        updates.publish("e1");

        expect(woken).toBe(0);
    });

    it("남의 실행은 존재 자체를 알리지 않는다", async () => {
        const { useCase } = makeUseCase();

        await expect(useCase.snapshot("other", "t1", "e1")).rejects.toThrow("Chat execution not found");
    });
});
