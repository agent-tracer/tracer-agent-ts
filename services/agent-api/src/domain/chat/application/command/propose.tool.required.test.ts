import { describe, expect, it } from "vitest";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { CHAT_TOOL_CONTRACT } from "~agent-api/domain/chat/model/chat.tool.schema.js";
import { FixedClock } from "~agent-api/domain/chat/port/__fakes__/fixed.clock.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatPendingToolRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { RecordingChatExecutionUpdates } from "~agent-api/domain/chat/port/__fakes__/recording.chat.execution.updates.js";
import { SequentialChatIdGenerator } from "~agent-api/domain/chat/port/__fakes__/sequential.chat.id.generator.js";
import { ProposeToolUseCase } from "./propose.tool.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): ProposeToolUseCase {
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
    return new ProposeToolUseCase(
        threads,
        new InMemoryChatPendingToolRepository(),
        new FixedClock(NOW),
        new SequentialChatIdGenerator(),
        executions,
        new RecordingChatExecutionUpdates(),
    );
}

/** 인자 하나를 계약이 받아들이는 값으로 채운다. */
function filledValue(tool: string, argName: string): unknown {
    const arg = CHAT_TOOL_CONTRACT.tools[tool]?.args[argName];
    switch (arg?.type) {
        case "array":
            return ["x"];
        case "object":
            return { note: "x" };
        case "integer":
            return arg.min ?? 1;
        case "enum":
            return arg.values?.[0];
        default:
            return "x";
    }
}

/** 그 action 에 필요한 인자를 모두 채운 호출이며 omit 한 자리만 비운다. */
function callFor(tool: string, action: string, omit?: string): Record<string, unknown> {
    const required = CHAT_TOOL_CONTRACT.tools[tool]?.requiredByAction?.[action] ?? [];
    const args: Record<string, unknown> = { action };
    for (const name of required) {
        if (name !== omit) args[name] = filledValue(tool, name);
    }
    return args;
}

/** 계약 표가 가진 (도구, action, 인자) 조합 전부다. */
const COMBINATIONS = Object.entries(CHAT_TOOL_CONTRACT.tools).flatMap(([tool, declared]) =>
    Object.entries(declared.requiredByAction ?? {}).flatMap(([action, names]) =>
        names.map((argName) => ({ tool, action, argName })),
    ),
);

async function rejects(args: Record<string, unknown>, tool: string): Promise<boolean> {
    return makeUseCase()
        .execute({ userId: "local", threadId: "t1", toolName: tool, args })
        .then(() => false, () => true);
}

describe("계약 표가 요구하는 인자 전부", () => {
    it("표가 비어 있지 않다", () => {
        expect(COMBINATIONS.length).toBeGreaterThan(0);
    });

    it.each(COMBINATIONS)("$tool.$action 은 $argName 이 빠지면 거절한다", async ({ tool, action, argName }) => {
        expect(await rejects(callFor(tool, action, argName), tool)).toBe(true);
    });

    it.each(COMBINATIONS)("$tool.$action 은 $argName 이 비어도 거절한다", async ({ tool, action, argName }) => {
        const args = callFor(tool, action);
        const arg = CHAT_TOOL_CONTRACT.tools[tool]?.args[argName];
        args[argName] = arg?.type === "array" ? [] : "";

        expect(await rejects(args, tool)).toBe(true);
    });

    it.each(COMBINATIONS)("$tool.$action 은 $argName 을 갖추면 세운다", async ({ tool, action }) => {
        expect(await rejects(callFor(tool, action), tool)).toBe(false);
    });
});
