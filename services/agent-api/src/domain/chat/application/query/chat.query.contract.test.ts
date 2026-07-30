import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
    CHAT_EXECUTION_STATUSES,
    CHAT_MESSAGE_ROLE,
    CHAT_MESSAGE_ROLES,
    CHAT_PENDING_TOOL_STATUSES,
    CHAT_STOP_REASONS,
} from "~agent-api/domain/chat/model/chat.const.js";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import {
    CHAT_STEP_EVENT_KINDS,
    CHAT_STEP_ROLES,
    type ChatExecutionStep,
} from "~agent-api/domain/chat/model/chat.execution.step.model.js";
import { ChatMessage } from "~agent-api/domain/chat/model/chat.message.model.js";
import { ChatPendingTool } from "~agent-api/domain/chat/model/chat.pending.tool.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { ChatUserMemory } from "~agent-api/domain/chat/model/chat.user.memory.model.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatExecutionStepRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.step.repository.js";
import { InMemoryChatMessageRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatPendingToolRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { InMemoryChatUserMemoryRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.user.memory.repository.js";
import { RecordingChatExecutionUpdates } from "~agent-api/domain/chat/port/__fakes__/recording.chat.execution.updates.js";
import { GetChatExecutionStepsUseCase } from "./get.chat.execution.steps.usecase.js";
import { GetChatReplayUseCase } from "./get.chat.replay.usecase.js";
import { GetMessagesUseCase } from "./get.messages.usecase.js";
import { GetThreadUseCase } from "./get.thread.usecase.js";
import { ListChatExecutionsUseCase } from "./list.chat.executions.usecase.js";
import { ListThreadsUseCase } from "./list.threads.usecase.js";
import { WatchChatExecutionUseCase } from "./watch.chat.execution.usecase.js";

interface Shape {
    readonly fields?: readonly string[];
    readonly required?: readonly string[];
    readonly optional?: readonly string[];
}

interface ChatQueryCase {
    readonly shapes: Readonly<Record<string, Shape>>;
    readonly enums: Readonly<Record<string, readonly string[]>>;
    readonly windows: readonly {
        readonly path: string;
        readonly method: string;
        readonly data: string | Readonly<Record<string, string>>;
    }[];
    readonly stream: { readonly frame: string };
}

const CONTRACT_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../../../../contract",
);

const contract = JSON.parse(
    readFileSync(path.join(CONTRACT_ROOT, "conformance/cases/chat.query.json"), "utf8"),
) as ChatQueryCase;

const NOW = new Date("2026-01-01T00:00:00.000Z");

function at(seconds: number): Date {
    return new Date(NOW.getTime() + seconds * 1000);
}

/** 창구 하나가 봉투를 벗긴 data에 실어야 하는 칸이며 shape 하나를 그대로 싣는 창구는 빈 목록이다. */
function envelopeKeys(method: string, urlPath: string): readonly string[] {
    const window = contract.windows.find((entry) => entry.method === method && entry.path === urlPath);
    if (window === undefined) throw new Error(`계약에 없는 창구다 — ${method} ${urlPath}`);
    return typeof window.data === "string" ? [] : Object.keys(window.data);
}

function fields(name: string): readonly string[] {
    const shape = contract.shapes[name];
    if (shape?.fields === undefined) throw new Error(`칸 목록이 없는 모양이다 — ${name}`);
    return shape.fields;
}

function threads(): InMemoryChatThreadRepository {
    const repository = new InMemoryChatThreadRepository();
    repository.seed(ChatThread.create({ id: "t1", userId: "local", title: "첫 대화", now: NOW }));
    return repository;
}

function executions(): InMemoryChatExecutionRepository {
    const repository = new InMemoryChatExecutionRepository();
    repository.seed(ChatExecution.create({
        id: "e1", userId: "local", threadId: "t1", userMessageId: "m3", clientRequestId: "r1",
        inputHash: "h", model: null, language: null, now: NOW,
    }));
    return repository;
}

function messages(): InMemoryChatMessageRepository {
    const repository = new InMemoryChatMessageRepository();
    repository.seed(
        ChatMessage.create({
            id: "m1", threadId: "t1", role: CHAT_MESSAGE_ROLE.assistant, content: "찾아본다",
            toolCalls: [{ id: "call-1", name: "search_tasks", args: {} }], now: at(0),
        }),
        ChatMessage.create({
            id: "m2", threadId: "t1", role: CHAT_MESSAGE_ROLE.tool, content: "결과",
            toolCallId: "call-1", now: at(1),
        }),
        ChatMessage.create({
            id: "m3", threadId: "t1", role: CHAT_MESSAGE_ROLE.user, content: "이어서", now: at(2),
        }),
    );
    return repository;
}

function pendingTools(): InMemoryChatPendingToolRepository {
    const repository = new InMemoryChatPendingToolRepository();
    repository.seed(ChatPendingTool.create({
        id: "c1", threadId: "t1", messageId: null, toolName: "archive_task", args: {}, now: NOW,
    }));
    return repository;
}

function memories(): InMemoryChatUserMemoryRepository {
    const repository = new InMemoryChatUserMemoryRepository();
    repository.seed(ChatUserMemory.create({
        id: "1", userId: "local", key: "editor", content: "vim", now: NOW,
    }));
    return repository;
}

function step(overrides: Partial<ChatExecutionStep>): ChatExecutionStep {
    return {
        id: "s1", executionId: "e1", userId: "local", attempt: 1, seq: 0, role: "assistant",
        content: "생각", truncated: false, toolCalls: null, toolName: null, toolCallId: null,
        inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheCreationTokens: null,
        stopReason: null, nodeName: null, eventKind: null, durationMs: null, createdAt: NOW,
        ...overrides,
    };
}

function steps(): InMemoryChatExecutionStepRepository {
    const repository = new InMemoryChatExecutionStepRepository();
    repository.seed(step({}), step({
        id: "s2", seq: 1, role: "tool", toolCalls: [], toolName: "search_tasks", toolCallId: "call-1",
        inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheCreationTokens: 4,
        stopReason: "end_turn", nodeName: "plan", eventKind: "node.completed", durationMs: 12,
    }));
    return repository;
}

describe("대화 조회 표면", () => {
    it("스레드 목록과 상세가 계약이 열거한 칸을 낸다", async () => {
        const listed = await new ListThreadsUseCase(threads()).execute("local");
        const detail = await new GetThreadUseCase(threads()).execute("local", "t1");

        expect(Object.keys(listed)).toEqual(envelopeKeys("GET", "/api/agent/chat/threads"));
        expect(Object.keys(detail)).toEqual(envelopeKeys("GET", "/api/agent/chat/threads/{threadId}"));
        expect(Object.keys(listed.items[0] ?? {})).toEqual(fields("thread"));
        expect(Object.keys(detail.thread)).toEqual(fields("thread"));
    });

    it("메시지 목록이 계약이 열거한 칸을 낸다", async () => {
        const listed = await new GetMessagesUseCase(threads(), messages()).execute("local", "t1");

        expect(Object.keys(listed))
            .toEqual(envelopeKeys("GET", "/api/agent/chat/threads/{threadId}/messages"));
        expect(Object.keys(listed.items[0] ?? {})).toEqual(fields("message"));
    });

    it("실행 목록이 실행과 대기 도구의 칸을 함께 낸다", async () => {
        const listed = await new ListChatExecutionsUseCase(threads(), executions(), pendingTools())
            .execute("local", "t1");

        expect(Object.keys(listed))
            .toEqual(envelopeKeys("GET", "/api/agent/chat/threads/{threadId}/executions"));
        expect(Object.keys(listed.items[0] ?? {})).toEqual(fields("execution"));
        expect(Object.keys(listed.confirmations[0] ?? {})).toEqual(fields("confirmation"));
    });

    it("궤적이 요구하는 칸을 갖고 값이 없는 칸은 싣지 않는다", async () => {
        const listed = await new GetChatExecutionStepsUseCase(executions(), steps())
            .execute("local", "t1", "e1");
        const shape = contract.shapes["step"];

        expect(Object.keys(listed))
            .toEqual(envelopeKeys("GET", "/api/agent/chat/threads/{threadId}/executions/{executionId}/steps"));
        expect(Object.keys(listed.items[0] ?? {})).toEqual(shape?.required);
        expect(Object.keys(listed.items[1] ?? {}).sort())
            .toEqual([...(shape?.required ?? []), ...(shape?.optional ?? [])].sort());
    });

    it("되읽기가 이력과 요약과 기억의 칸을 낸다", async () => {
        const replay = await new GetChatReplayUseCase(executions(), threads(), messages(), memories())
            .execute("local", "t1", "e1");
        const message = contract.shapes["replayMessage"];

        expect(Object.keys(replay)).toEqual(fields("replay"));
        expect(Object.keys(replay.facts[0] ?? {})).toEqual(fields("userFact"));
        expect(Object.keys(replay.messages[0] ?? {}).sort())
            .toEqual([...(message?.required ?? []), "toolCalls"].sort());
        expect(Object.keys(replay.messages[1] ?? {}).sort())
            .toEqual([...(message?.required ?? []), "toolCallId"].sort());
        expect(Object.keys(replay.messages[2] ?? {})).toEqual(message?.required);
    });

    it("열린 연결의 프레임이 계약이 적은 모양을 낸다", async () => {
        const useCase = new WatchChatExecutionUseCase(
            threads(), executions(), pendingTools(), new RecordingChatExecutionUpdates(),
        );

        const snapshot = await useCase.snapshot("local", "t1", "e1");

        expect(Object.keys(snapshot)).toEqual(fields(contract.stream.frame));
        expect(Object.keys(snapshot.execution)).toEqual(fields("execution"));
        expect(Object.keys(snapshot.confirmations[0] ?? {})).toEqual(fields("confirmation"));
    });

    it("조회가 내는 어휘를 계약과 같게 안다", () => {
        expect(CHAT_MESSAGE_ROLES).toEqual(contract.enums["messageRole"]);
        expect(CHAT_STEP_ROLES).toEqual(contract.enums["stepRole"]);
        expect(CHAT_EXECUTION_STATUSES).toEqual(contract.enums["executionStatus"]);
        expect(CHAT_STOP_REASONS).toEqual(contract.enums["stopReason"]);
        expect(CHAT_PENDING_TOOL_STATUSES).toEqual(contract.enums["confirmationStatus"]);
        expect(CHAT_STEP_EVENT_KINDS).toEqual(contract.enums["stepEventKind"]);
    });
});
