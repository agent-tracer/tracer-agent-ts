import { describe, expect, it } from "vitest";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { ChatPendingTool } from "~agent-api/domain/chat/model/chat.pending.tool.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatPendingToolRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { ListChatExecutionsUseCase } from "./list.chat.executions.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): ListChatExecutionsUseCase {
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
    const resolved = ChatPendingTool.create({
        id: "c2", threadId: "t1", messageId: null, toolName: "delete_task", args: {}, now: NOW,
    });
    resolved.approve(NOW);
    pendingTools.seed(
        ChatPendingTool.create({ id: "c1", threadId: "t1", messageId: null, toolName: "archive_task", args: { taskId: "task-1" }, now: NOW }),
        resolved,
    );
    return new ListChatExecutionsUseCase(threads, executions, pendingTools);
}

describe("ListChatExecutionsUseCase", () => {
    it("스레드의 실행 이력을 준다", async () => {
        const { items } = await makeUseCase().execute("local", "t1");

        expect(items.map((item) => item.id)).toEqual(["e1"]);
    });

    it("아직 승인을 기다리는 도구만 함께 준다", async () => {
        const { confirmations } = await makeUseCase().execute("local", "t1");

        expect(confirmations).toEqual([{ id: "c1", toolName: "archive_task", args: { taskId: "task-1" } }]);
    });

    it("남의 스레드는 존재 자체를 알리지 않는다", async () => {
        await expect(makeUseCase().execute("other", "t1")).rejects.toThrow("Thread not found");
    });
});
