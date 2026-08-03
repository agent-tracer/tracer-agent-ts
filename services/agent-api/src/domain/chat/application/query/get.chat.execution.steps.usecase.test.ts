import { describe, expect, it } from "vitest";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import type { ChatExecutionStep } from "~agent-api/domain/chat/model/chat.execution.step.model.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatExecutionStepRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.step.repository.js";
import { GetChatExecutionStepsUseCase } from "./get.chat.execution.steps.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function step(overrides: Partial<ChatExecutionStep>): ChatExecutionStep {
    return {
        id: "s1",
        executionId: "e1",
        userId: "local",
        attempt: 1,
        seq: 0,
        role: "assistant",
        content: "생각",
        truncated: false,
        toolCalls: null,
        toolName: null,
        toolCallId: null,
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheCreationTokens: null,
        stopReason: null,
        nodeName: null,
        eventKind: null,
        durationMs: null,
        createdAt: NOW,
        ...overrides,
    };
}

function makeUseCase(): GetChatExecutionStepsUseCase {
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
    const steps = new InMemoryChatExecutionStepRepository();
    steps.seed(
        step({ id: "s2", seq: 1, role: "tool", content: "결과", toolName: "search_tasks", durationMs: 12 }),
        step({ id: "s1", seq: 0 }),
    );
    return new GetChatExecutionStepsUseCase(executions, steps);
}

describe("GetChatExecutionStepsUseCase", () => {
    it("턴 하나의 궤적을 순서대로 준다", async () => {
        const { items } = await makeUseCase().execute("local", "t1", "e1");

        expect(items.map((item) => item.seq)).toEqual([0, 1]);
    });

    it("값이 없는 자리는 싣지 않는다", async () => {
        const { items } = await makeUseCase().execute("local", "t1", "e1");

        expect(items[0]).not.toHaveProperty("toolName");
        expect(items[1]).toMatchObject({ toolName: "search_tasks", durationMs: 12 });
    });

    it("남의 실행은 존재 자체를 알리지 않는다", async () => {
        await expect(makeUseCase().execute("other", "t1", "e1"))
            .rejects.toThrow("Chat execution not found");
    });
});
