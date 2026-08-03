import { describe, expect, it } from "vitest";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { FixedClock } from "~agent-api/domain/chat/port/__fakes__/fixed.clock.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatPendingToolRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { RecordingChatExecutionUpdates } from "~agent-api/domain/chat/port/__fakes__/recording.chat.execution.updates.js";
import { SequentialChatIdGenerator } from "~agent-api/domain/chat/port/__fakes__/sequential.chat.id.generator.js";
import { ProposeToolUseCase } from "./propose.tool.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): {
    useCase: ProposeToolUseCase;
    pendingTools: InMemoryChatPendingToolRepository;
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
    const pendingTools = new InMemoryChatPendingToolRepository();
    const updates = new RecordingChatExecutionUpdates();
    return {
        useCase: new ProposeToolUseCase(
            threads,
            pendingTools,
            new FixedClock(NOW),
            new SequentialChatIdGenerator(),
            executions,
            updates,
        ),
        pendingTools,
        updates,
    };
}

describe("ProposeToolUseCase", () => {
    it("쓰기 도구 호출을 실행하지 않고 대기 행으로 세운다", async () => {
        const { useCase, pendingTools } = makeUseCase();

        const result = await useCase.execute({
            userId: "local",
            threadId: "t1",
            toolName: "archive_task",
            args: { taskId: "task-1" },
        });

        expect(result).toMatchObject({ toolName: "archive_task", status: "pending" });
        expect(await pendingTools.listByThread("t1")).toHaveLength(1);
    });

    it("무엇을 승인하는지 한 줄로 줄여 보인다", async () => {
        const { useCase } = makeUseCase();

        const result = await useCase.execute({
            userId: "local",
            threadId: "t1",
            toolName: "archive_task",
            args: { taskId: "task-1" },
        });

        expect(result.summary).toBe("archive_task(taskId=task-1)");
    });

    it("대기 행이 생기면 열린 연결을 깨운다", async () => {
        const { useCase, updates } = makeUseCase();

        await useCase.execute({ userId: "local", threadId: "t1", toolName: "archive_task", args: { taskId: "task-1" } });

        expect(updates.published).toEqual(["e1"]);
    });

    it("확인 게이트가 없는 도구를 거절한다", async () => {
        const { useCase } = makeUseCase();

        await expect(useCase.execute({ userId: "local", threadId: "t1", toolName: "search_tasks", args: {} }))
            .rejects.toThrow("search_tasks is not a confirmable tool");
    });

    it("계약을 만족하지 않는 인자를 거절한다", async () => {
        const { useCase } = makeUseCase();

        await expect(useCase.execute({ userId: "local", threadId: "t1", toolName: "archive_task", args: {} }))
            .rejects.toThrow("archive_task arguments are invalid");
    });

    it("남의 스레드에는 대기 행을 세우지 않는다", async () => {
        const { useCase } = makeUseCase();

        await expect(useCase.execute({ userId: "other", threadId: "t1", toolName: "archive_task", args: { taskId: "task-1" } }))
            .rejects.toThrow("Thread not found");
    });
});
