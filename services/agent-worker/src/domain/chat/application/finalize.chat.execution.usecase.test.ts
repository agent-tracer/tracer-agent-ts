import { describe, expect, it, vi } from "vitest";
import { CHAT_EXECUTION_STATUS, CHAT_STOP_REASON } from "~agent-worker/domain/chat/model/chat.const.js";
import {
    FixedClock,
    PassthroughChatTransaction,
    RecordingChatExecutionUpdates,
    SequentialChatIdGenerator,
    chatExecution,
    chatObservation,
    chatThread,
    chatTurnResult,
} from "~agent-worker/domain/chat/port/__fakes__/chat.test-support.js";
import {
    InMemoryAgentRunObservationRepository,
    InMemoryChatExecutionRepository,
    InMemoryChatExecutionStepRepository,
    InMemoryChatMessageRepository,
    InMemoryChatThreadRepository,
} from "~agent-worker/domain/chat/port/__fakes__/in-memory.chat.repository.js";
import { FinalizeChatExecutionUsecase } from "./finalize.chat.execution.usecase.js";

function setup() {
    const executions = new InMemoryChatExecutionRepository();
    const threads = new InMemoryChatThreadRepository();
    const messages = new InMemoryChatMessageRepository();
    const steps = new InMemoryChatExecutionStepRepository();
    const observations = new InMemoryAgentRunObservationRepository();
    const events = new RecordingChatExecutionUpdates();
    const summaryProjection = { project: vi.fn().mockResolvedValue(undefined) };
    const titleProjection = { project: vi.fn().mockResolvedValue(undefined) };
    threads.add(chatThread());
    const transaction = new PassthroughChatTransaction({
        agentRunObservations: observations,
        chatExecutions: executions,
        chatExecutionSteps: steps,
        chatMessages: messages,
        chatThreads: threads,
    });
    return {
        executions,
        threads,
        messages,
        steps,
        observations,
        events,
        summaryProjection,
        titleProjection,
        usecase: new FinalizeChatExecutionUsecase(
            executions,
            threads,
            messages,
            transaction,
            new FixedClock(),
            new SequentialChatIdGenerator(),
            events,
            summaryProjection as never,
            titleProjection as never,
        ),
    };
}

describe("FinalizeChatExecutionUsecase", () => {
    it("실행을 완료로 닫고 답변과 관측과 궤적을 한 번에 새긴다", async () => {
        const { executions, messages, steps, observations, usecase } = setup();
        executions.add(chatExecution({ status: CHAT_EXECUTION_STATUS.running, attempt: 1 }));

        await usecase.execute({
            executionId: "exec-1",
            attempt: 1,
            result: chatTurnResult({
                steps: [{ seq: 0, role: "assistant", content: "답변", truncated: false, toolCalls: [] }],
            }),
        });

        expect(executions.rows.get("exec-1")?.status).toBe(CHAT_EXECUTION_STATUS.completed);
        expect(messages.rows).toHaveLength(1);
        expect(steps.rows).toHaveLength(1);
        expect(observations.rows).toHaveLength(1);
    });

    it("이미 완료된 실행은 다시 닫지 않는다", async () => {
        const { executions, messages, usecase } = setup();
        executions.add(chatExecution({ status: CHAT_EXECUTION_STATUS.completed, attempt: 1 }));

        await usecase.execute({ executionId: "exec-1", attempt: 1, result: chatTurnResult() });

        expect(messages.rows).toHaveLength(0);
    });

    it("관측이 가리키는 시도가 다르면 종결하지 않는다", async () => {
        const { executions, usecase } = setup();
        executions.add(chatExecution({ status: CHAT_EXECUTION_STATUS.running, attempt: 2 }));

        await expect(
            usecase.execute({ executionId: "exec-1", attempt: 2, result: chatTurnResult() }),
        ).rejects.toThrow("does not match execution attempt");
    });

    it("취소된 실행이 남긴 답변이 비어 있으면 아무것도 적재하지 않는다", async () => {
        const { executions, messages, usecase } = setup();
        executions.add(chatExecution({ status: CHAT_EXECUTION_STATUS.canceled, attempt: 1 }));

        await usecase.execute({
            executionId: "exec-1",
            attempt: 1,
            result: chatTurnResult({ text: "   " }),
        });

        expect(messages.rows).toHaveLength(0);
    });

    it("취소된 실행의 정지 사유를 취소로 남기고 요약을 실행하지 않는다", async () => {
        const { executions, summaryProjection, usecase } = setup();
        executions.add(chatExecution({ status: CHAT_EXECUTION_STATUS.canceled, attempt: 1 }));

        await usecase.execute({
            executionId: "exec-1",
            attempt: 1,
            result: chatTurnResult({
                observation: chatObservation({ status: "cancelled" }),
                stopReason: CHAT_STOP_REASON.completed,
            }),
        });

        expect(executions.rows.get("exec-1")?.stopReason).toBe(CHAT_STOP_REASON.canceled);
        expect(summaryProjection.project).not.toHaveBeenCalled();
    });

    it("완료한 턴 뒤에 요약과 제목 단계를 밟는다", async () => {
        const { executions, summaryProjection, titleProjection, usecase } = setup();
        executions.add(chatExecution({ status: CHAT_EXECUTION_STATUS.running, attempt: 1 }));

        await usecase.execute({ executionId: "exec-1", attempt: 1, result: chatTurnResult() });

        expect(summaryProjection.project).toHaveBeenCalledTimes(1);
        expect(titleProjection.project).toHaveBeenCalledTimes(1);
    });
});
