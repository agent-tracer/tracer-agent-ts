import { describe, expect, it } from "vitest";
import { CHAT_EXECUTION_STATUS } from "~agent-worker/domain/chat/model/chat.const.js";
import {
    FixedClock,
    RecordingChatExecutionUpdates,
    chatExecution,
} from "~agent-worker/domain/chat/port/__fakes__/chat.test-support.js";
import { InMemoryChatExecutionRepository } from "~agent-worker/domain/chat/port/__fakes__/in-memory.chat.repository.js";
import { FailChatExecutionUsecase } from "./fail.chat.execution.usecase.js";

describe("FailChatExecutionUsecase", () => {
    it("실행을 실패로 닫고 사유를 남긴다", async () => {
        const executions = new InMemoryChatExecutionRepository();
        const events = new RecordingChatExecutionUpdates();
        executions.add(chatExecution({ status: CHAT_EXECUTION_STATUS.running }));

        await new FailChatExecutionUsecase(executions, new FixedClock(), events).execute("exec-1", "boom");

        expect(executions.rows.get("exec-1")).toMatchObject({
            status: CHAT_EXECUTION_STATUS.failed,
            error: "boom",
        });
        expect(events.published).toEqual(["exec-1"]);
    });

    it("이미 완료된 실행은 실패로 덮지 않는다", async () => {
        const executions = new InMemoryChatExecutionRepository();
        const events = new RecordingChatExecutionUpdates();
        executions.add(chatExecution({ status: CHAT_EXECUTION_STATUS.completed }));

        await new FailChatExecutionUsecase(executions, new FixedClock(), events).execute("exec-1", "boom");

        expect(executions.rows.get("exec-1")?.status).toBe(CHAT_EXECUTION_STATUS.completed);
        expect(events.published).toEqual([]);
    });
});
