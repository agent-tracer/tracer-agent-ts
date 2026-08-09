import { describe, expect, it } from "vitest";
import { CHAT_EXECUTION_STATUS } from "~agent-worker/domain/chat/model/chat.const.js";
import { chatExecution } from "~agent-worker/domain/chat/port/__fakes__/chat.test-support.js";
import { InMemoryChatExecutionRepository } from "~agent-worker/domain/chat/port/__fakes__/in-memory.chat.repository.js";
import { GetNextChatExecutionUsecase } from "./get.next.chat.execution.usecase.js";

describe("GetNextChatExecutionUsecase", () => {
    it("스레드에 대기 중인 실행이 없으면 아무것도 내지 않는다", async () => {
        const executions = new InMemoryChatExecutionRepository();

        expect(await new GetNextChatExecutionUsecase(executions).execute("thread-1")).toBeNull();
    });

    it("대기 중인 실행 가운데 가장 먼저 접수된 것을 낸다", async () => {
        const executions = new InMemoryChatExecutionRepository();
        executions.add(chatExecution({ id: "exec-2" }));
        executions.add(chatExecution({ id: "exec-1" }));

        expect(await new GetNextChatExecutionUsecase(executions).execute("thread-1")).toBe("exec-1");
    });

    // 원장은 createdAt 을 먼저 보고 id 는 같은 시각을 구분한다.
    it("식별자 순서가 접수 시각과 어긋나면 먼저 접수된 것을 낸다", async () => {
        const executions = new InMemoryChatExecutionRepository();
        executions.add(chatExecution({ id: "exec-1", createdAt: new Date("2026-01-01T00:00:10Z") }));
        executions.add(chatExecution({ id: "exec-2", createdAt: new Date("2026-01-01T00:00:01Z") }));

        expect(await new GetNextChatExecutionUsecase(executions).execute("thread-1")).toBe("exec-2");
    });

    it("이미 실행 중인 것은 다시 가져가지 않는다", async () => {
        const executions = new InMemoryChatExecutionRepository();
        executions.add(chatExecution({ id: "exec-1", status: CHAT_EXECUTION_STATUS.running }));

        expect(await new GetNextChatExecutionUsecase(executions).execute("thread-1")).toBeNull();
    });
});
