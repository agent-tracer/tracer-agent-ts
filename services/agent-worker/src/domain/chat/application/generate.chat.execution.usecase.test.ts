import { describe, expect, it } from "vitest";
import { CHAT_STOP_REASON } from "~agent-worker/domain/chat/model/chat.const.js";
import { ChatMissingApiKeyError, ChatTurnStalledError } from "~agent-worker/domain/chat/model/chat.errors.js";
import type { ChatTurnInput, ChatTurnSink } from "~agent-worker/domain/chat/model/chat.turn.model.js";
import type { ChatAgentPort } from "~agent-worker/domain/chat/port/chat.agent.port.js";
import type {
    ChatExecutionSinkFactoryPort,
    ChatExecutionSinkHandle,
    ChatSchedulerPort,
} from "~agent-worker/domain/chat/port/chat.execution.sink.port.js";
import type { ChatReplayPort } from "~agent-worker/domain/chat/port/chat.replay.port.js";
import type {
    ChatDraftTokenPort,
    ChatScopeTokenPort,
} from "~agent-worker/domain/chat/port/chat.token.port.js";
import type { ChatSettingReaderPort } from "~agent-worker/domain/chat/port/setting.reader.port.js";
import {
    FixedClock,
    chatExecution,
    chatTurnResult,
} from "~agent-worker/domain/chat/port/__fakes__/chat.test-support.js";
import { InMemoryChatExecutionRepository } from "~agent-worker/domain/chat/port/__fakes__/in-memory.chat.repository.js";
import { GenerateChatExecutionUsecase } from "./generate.chat.execution.usecase.js";

const PREPARED = {
    executionId: "exec-1",
    threadId: "thread-1",
    userId: "user-1",
    replayAnchorMessageId: "message-1",
    language: "auto",
};

class FakeChatAgent implements ChatAgentPort {
    lastInput: ChatTurnInput | null = null;

    constructor(
        private readonly needsKey = false,
        private readonly behavior: (input: ChatTurnInput) => Promise<ReturnType<typeof chatTurnResult>> =
            () => Promise.resolve(chatTurnResult()),
    ) {}

    requiresLocalApiKey(): boolean {
        return this.needsKey;
    }

    converse(input: ChatTurnInput, _sink: ChatTurnSink) {
        this.lastInput = input;
        return this.behavior(input);
    }
}

class RecordingSinkFactory implements ChatExecutionSinkFactoryPort {
    flushes = 0;
    closes = 0;

    create(): ChatExecutionSinkHandle {
        return {
            sink: {
                onAssistantDelta: () => undefined,
                onToolCall: () => undefined,
                onToolResult: () => undefined,
            },
            flush: async () => {
                this.flushes += 1;
            },
            close: () => {
                this.closes += 1;
            },
        };
    }
}

/** 예약된 콜백을 시험이 직접 밟는 대역이다. */
class ManualScheduler implements ChatSchedulerPort {
    private pending: (() => void)[] = [];

    schedule(_delayMs: number, callback: () => void): object {
        const handle = { callback };
        this.pending.push(callback);
        return handle;
    }

    cancel(): void {
        this.pending = [];
    }

    tick(): void {
        const due = this.pending;
        this.pending = [];
        for (const callback of due) callback();
    }
}

const draftTokens: ChatDraftTokenPort = {
    issue: () => ({ token: "draft-token", hash: "draft-hash" }),
    hash: () => "draft-hash",
};

const scopeTokens: ChatScopeTokenPort = { issue: () => "scope-token" };

const replay: ChatReplayPort = {
    fetchReplay: async () => ({
        messages: [{ role: "user", content: "안녕" }],
        summary: null,
        facts: [{ key: "tone", content: "짧게" }],
    }),
};

function settings(value: string | null): ChatSettingReaderPort {
    return { findValue: async () => value };
}

function setup(agent: ChatAgentPort, reader: ChatSettingReaderPort = settings(null)) {
    const executions = new InMemoryChatExecutionRepository();
    executions.add(chatExecution({ status: "running" }));
    const sinks = new RecordingSinkFactory();
    const scheduler = new ManualScheduler();
    const clock = new FixedClock();
    return {
        executions,
        sinks,
        scheduler,
        clock,
        usecase: new GenerateChatExecutionUsecase(
            agent,
            reader,
            sinks,
            executions,
            draftTokens,
            scopeTokens,
            clock,
            scheduler,
            () => replay,
        ),
    };
}

describe("GenerateChatExecutionUsecase", () => {
    it("시도를 열고 재생한 이력으로 턴을 실행한다", async () => {
        const agent = new FakeChatAgent();
        const { executions, usecase } = setup(agent);

        const generated = await usecase.execute(PREPARED, new AbortController().signal, 1);

        expect(generated).toMatchObject({ executionId: "exec-1", attempt: 1 });
        expect(executions.rows.get("exec-1")?.attempt).toBe(1);
        expect(agent.lastInput?.messages).toHaveLength(1);
        expect(agent.lastInput?.facts).toHaveLength(1);
    });

    it("시도가 뒤처졌으면 실행하지 않는다", async () => {
        const agent = new FakeChatAgent();
        const { executions, usecase } = setup(agent);
        executions.rows.get("exec-1")!.attempt = 5;

        await expect(usecase.execute(PREPARED, new AbortController().signal, 1)).rejects.toThrow(
            "attempt is stale",
        );
    });

    it("러너가 자격을 요구하는데 설정에 키가 없으면 거절한다", async () => {
        const { usecase } = setup(new FakeChatAgent(true), settings(null));

        await expect(usecase.execute(PREPARED, new AbortController().signal, 1)).rejects.toBeInstanceOf(
            ChatMissingApiKeyError,
        );
    });

    it("취소가 아닌데 답변이 비어 있으면 실패로 본다", async () => {
        const agent = new FakeChatAgent(false, () => Promise.resolve(chatTurnResult({ text: "  " })));
        const { usecase } = setup(agent);

        await expect(usecase.execute(PREPARED, new AbortController().signal, 1)).rejects.toThrow(
            "produced no assistant response",
        );
    });

    it("취소로 끊긴 턴이 빈 답변으로 끝나는 것은 실패가 아니다", async () => {
        const controller = new AbortController();
        const agent = new FakeChatAgent(false, () => {
            controller.abort();
            return Promise.resolve(chatTurnResult({ text: "" }));
        });
        const { usecase } = setup(agent);

        const generated = await usecase.execute(PREPARED, controller.signal, 1);

        expect(generated.result.text).toBe("");
    });

    it("진행이 끊긴 턴은 정지 사유를 멈춤으로 남긴다", async () => {
        let scheduler: ManualScheduler | null = null;
        const agent = new FakeChatAgent(false, async () => {
            // 감시 주기를 두 번 밟는 동안 아무 진행도 보고하지 않는다.
            harness.clock.advance(600_000);
            scheduler!.tick();
            return chatTurnResult();
        });
        const harness = setup(agent);
        scheduler = harness.scheduler;

        const generated = await harness.usecase.execute(PREPARED, new AbortController().signal, 1);

        expect(generated.result.stopReason).toBe(CHAT_STOP_REASON.stalled);
    });

    it("멈춤으로 끊는 사유는 멈춤 오류로 알린다", () => {
        expect(new ChatTurnStalledError().code).toBe("chat.turn-stalled");
    });

    it("실행이 끝나면 남은 산출을 내려 쓰고 싱크를 닫는다", async () => {
        const { sinks, usecase } = setup(new FakeChatAgent());

        await usecase.execute(PREPARED, new AbortController().signal, 1);

        expect(sinks.flushes).toBeGreaterThanOrEqual(1);
        expect(sinks.closes).toBe(1);
    });
});
