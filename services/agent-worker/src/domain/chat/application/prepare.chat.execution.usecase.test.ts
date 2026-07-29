import { describe, expect, it } from "vitest";
import { CHAT_EXECUTION_STATUS } from "~agent-worker/domain/chat/model/chat.const.js";
import { ChatThreadBusyError } from "~agent-worker/domain/chat/model/chat.errors.js";
import { CHAT_RUNNING_LEASE_MS } from "~agent-worker/domain/chat/model/chat.workflow.spec.js";
import {
    FixedClock,
    NOW,
    RecordingChatExecutionUpdates,
    chatExecution,
    chatThread,
} from "~agent-worker/domain/chat/port/__fakes__/chat.test-support.js";
import {
    InMemoryChatExecutionRepository,
    InMemoryChatThreadRepository,
} from "~agent-worker/domain/chat/port/__fakes__/in-memory.chat.repository.js";
import { PrepareChatExecutionUsecase } from "./prepare.chat.execution.usecase.js";

function setup() {
    const executions = new InMemoryChatExecutionRepository();
    const threads = new InMemoryChatThreadRepository();
    const clock = new FixedClock();
    const events = new RecordingChatExecutionUpdates();
    threads.add(chatThread());
    return {
        executions,
        threads,
        clock,
        events,
        usecase: new PrepareChatExecutionUsecase(executions, threads, clock, events),
    };
}

describe("PrepareChatExecutionUsecase", () => {
    it("대기 중인 실행을 가져가 실행 중으로 올린다", async () => {
        const { executions, usecase } = setup();
        executions.add(chatExecution({ language: "ko", model: "claude-sonnet-4-6" }));

        const prepared = await usecase.execute("exec-1");

        expect(prepared).toMatchObject({ executionId: "exec-1", threadId: "thread-1", language: "ko" });
        expect(executions.rows.get("exec-1")?.status).toBe(CHAT_EXECUTION_STATUS.running);
    });

    it("언어를 정하지 않은 실행은 auto로 실행한다", async () => {
        const { executions, usecase } = setup();
        executions.add(chatExecution());

        expect((await usecase.execute("exec-1")).language).toBe("auto");
    });

    it("준비를 마치면 스냅샷이 바뀌었음을 알린다", async () => {
        const { executions, events, usecase } = setup();
        executions.add(chatExecution());

        await usecase.execute("exec-1");

        expect(events.published).toEqual(["exec-1"]);
    });

    it("살아 있는 실행이 스레드를 쥐고 있으면 물러난다", async () => {
        const { executions, usecase } = setup();
        executions.add(chatExecution());
        executions.threadBusy = true;

        await expect(usecase.execute("exec-1")).rejects.toBeInstanceOf(ChatThreadBusyError);
    });

    it("갱신이 끊긴 실행이 스레드를 쥐고 있으면 되돌리고 다시 가져간다", async () => {
        const { executions, clock, usecase } = setup();
        executions.add(chatExecution());
        executions.add(
            chatExecution({
                id: "exec-0",
                status: CHAT_EXECUTION_STATUS.running,
                updatedAt: new Date(NOW.getTime() - CHAT_RUNNING_LEASE_MS - 1),
            }),
        );
        executions.threadBusy = true;
        clock.advance(0);

        const prepared = await usecase.execute("exec-1");

        expect(prepared.executionId).toBe("exec-1");
        expect(executions.rows.get("exec-0")?.status).toBe(CHAT_EXECUTION_STATUS.queued);
    });

    it("스레드의 주인이 다르면 실행을 찾지 못한 것으로 본다", async () => {
        const { executions, threads, usecase } = setup();
        executions.add(chatExecution());
        threads.add(chatThread({ userId: "someone-else" }));

        await expect(usecase.execute("exec-1")).rejects.toThrow("Thread not found");
    });

    it("원장에 없는 실행은 찾지 못한 것으로 본다", async () => {
        const { usecase } = setup();

        await expect(usecase.execute("missing")).rejects.toThrow("Chat execution not found");
    });
});
