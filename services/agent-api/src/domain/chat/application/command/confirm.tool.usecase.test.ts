import { describe, expect, it } from "vitest";
import { ChatPendingTool } from "~agent-api/domain/chat/model/chat.pending.tool.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { FixedClock } from "~agent-api/domain/chat/port/__fakes__/fixed.clock.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatMessageRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatPendingToolRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { RecordingChatExecutionUpdates } from "~agent-api/domain/chat/port/__fakes__/recording.chat.execution.updates.js";
import { SequentialChatIdGenerator } from "~agent-api/domain/chat/port/__fakes__/sequential.chat.id.generator.js";
import type { ChatToolExecutorRegistry } from "~agent-api/domain/chat/port/chat.tool.executors.port.js";
import { ConfirmToolUseCase } from "./confirm.tool.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(executors: ChatToolExecutorRegistry): {
    useCase: ConfirmToolUseCase;
    messages: InMemoryChatMessageRepository;
    pendingTools: InMemoryChatPendingToolRepository;
} {
    const threads = new InMemoryChatThreadRepository();
    threads.seed(ChatThread.create({ id: "t1", userId: "local", title: "첫 대화", now: NOW }));
    const messages = new InMemoryChatMessageRepository();
    const pendingTools = new InMemoryChatPendingToolRepository();
    pendingTools.seed(ChatPendingTool.create({
        id: "c1",
        threadId: "t1",
        messageId: null,
        toolName: "archive_task",
        args: { taskId: "task-1" },
        now: NOW,
    }));
    return {
        useCase: new ConfirmToolUseCase(
            threads,
            messages,
            pendingTools,
            executors,
            new FixedClock(NOW),
            new SequentialChatIdGenerator(),
            new InMemoryChatExecutionRepository(),
            new RecordingChatExecutionUpdates(),
        ),
        messages,
        pendingTools,
    };
}

const APPROVED: ChatToolExecutorRegistry = {
    archive_task: () => Promise.resolve("Archived task task-1."),
};

describe("ConfirmToolUseCase", () => {
    it("승인하면 도구를 실행하고 결과를 대화에 남긴다", async () => {
        const { useCase, messages } = makeUseCase(APPROVED);

        const result = await useCase.execute({
            userId: "local", threadId: "t1", confirmationId: "c1", decision: "approve",
        });

        expect(result).toMatchObject({ status: "approved", result: "Archived task task-1." });
        expect((await messages.listByThread("t1"))[0]!.role).toBe("tool");
    });

    it("거절하면 실행하지 않고 거절 사실만 남긴다", async () => {
        const { useCase, messages } = makeUseCase({
            archive_task: () => Promise.reject(new Error("불려서는 안 된다")),
        });

        const result = await useCase.execute({
            userId: "local", threadId: "t1", confirmationId: "c1", decision: "reject",
        });

        expect(result.status).toBe("rejected");
        expect((await messages.listByThread("t1"))[0]!.content)
            .toBe("User rejected the proposed archive_task. It was not executed.");
    });

    it("실행이 실패하면 대기 행을 승인으로 넘기지 않는다", async () => {
        const { useCase, pendingTools } = makeUseCase({
            archive_task: () => Promise.reject(new Error("Task not found")),
        });

        await expect(useCase.execute({
            userId: "local", threadId: "t1", confirmationId: "c1", decision: "approve",
        })).rejects.toThrow("Task not found");
        expect((await pendingTools.findById("c1"))!.isPending()).toBe(true);
    });

    it("이미 해소된 확인을 다시 해소하지 않는다", async () => {
        const { useCase } = makeUseCase(APPROVED);
        await useCase.execute({ userId: "local", threadId: "t1", confirmationId: "c1", decision: "approve" });

        await expect(useCase.execute({
            userId: "local", threadId: "t1", confirmationId: "c1", decision: "approve",
        })).rejects.toThrow("Confirmation already resolved");
    });

    it("실행자가 없는 도구를 거절한다", async () => {
        const { useCase } = makeUseCase({});

        await expect(useCase.execute({
            userId: "local", threadId: "t1", confirmationId: "c1", decision: "approve",
        })).rejects.toThrow("No executor for tool archive_task");
    });

    it("남의 스레드에 걸린 확인은 존재 자체를 알리지 않는다", async () => {
        const { useCase } = makeUseCase(APPROVED);

        await expect(useCase.execute({
            userId: "other", threadId: "t1", confirmationId: "c1", decision: "approve",
        })).rejects.toThrow("Thread not found");
    });
});
