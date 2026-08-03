import type { IClock } from "@tracer-agent/platform";
import { ANTHROPIC_API_KEY_SETTING } from "~agent-worker/support/agent.const.js";
import { CHAT_STOP_REASON } from "~agent-worker/domain/chat/model/chat.const.js";
import {
    ChatMissingApiKeyError,
    ChatTurnStalledError,
} from "~agent-worker/domain/chat/model/chat.errors.js";
import type {
    GeneratedChatExecution,
    PreparedChatExecution,
} from "~agent-worker/domain/chat/model/chat.execution.stage.js";
import { CHAT_SPEC } from "~agent-worker/domain/chat/model/chat.spec.js";
import { ChatStallWatch } from "~agent-worker/domain/chat/model/chat.stall.watch.js";
import type { ChatTurnInput, ChatTurnResult } from "~agent-worker/domain/chat/model/chat.turn.model.js";
import type { ChatAgentPort } from "~agent-worker/domain/chat/port/chat.agent.port.js";
import type {
    ChatExecutionSinkFactoryPort,
    ChatSchedulerPort,
} from "~agent-worker/domain/chat/port/chat.execution.sink.port.js";
import type { ChatReplayClientFactory } from "~agent-worker/domain/chat/port/chat.replay.port.js";
import type { ChatExecutionRepositoryPort } from "~agent-worker/domain/chat/port/chat.repository.port.js";
import type {
    ChatDraftTokenPort,
    ChatScopeTokenPort,
} from "~agent-worker/domain/chat/port/chat.token.port.js";
import type { ChatSettingReaderPort } from "~agent-worker/domain/chat/port/setting.reader.port.js";

// 멈춤 판정은 초 단위면 충분하므로 감시 주기를 촘촘하게 두지 않는다.
const STALL_POLL_MS = 5_000;

export class GenerateChatExecutionUsecase {
    constructor(
        private readonly agent: ChatAgentPort,
        private readonly settings: ChatSettingReaderPort,
        private readonly sinks: ChatExecutionSinkFactoryPort,
        private readonly executions: ChatExecutionRepositoryPort,
        private readonly draftTokens: ChatDraftTokenPort,
        private readonly scopeTokens: ChatScopeTokenPort,
        private readonly clock: IClock,
        private readonly scheduler: ChatSchedulerPort,
        private readonly replayClients: ChatReplayClientFactory,
    ) {}

    async execute(
        prepared: PreparedChatExecution,
        abortSignal: AbortSignal,
        attempt: number,
    ): Promise<GeneratedChatExecution> {
        const grant = this.draftTokens.issue();
        // 시도를 열어야 이전 시도의 늦은 draft가 이 시도의 상태를 되돌리지 못한다.
        if (!(await this.executions.beginAttempt(prepared.executionId, attempt, grant.hash, this.clock.now()))) {
            throw new Error("Chat execution attempt is stale");
        }
        // 도구가 부를 API의 사용자 범위는 이 시도에 매인 자격이 정하며 시도의 마감과 함께 만료한다.
        const scopeToken = this.scopeTokens.issue(
            { userId: prepared.userId, executionId: prepared.executionId },
            this.clock.now(),
        );
        const sink = this.sinks.create(prepared.executionId, attempt);
        const watch = new ChatStallWatch(
            { nowMs: () => this.clock.now().getTime() },
            CHAT_SPEC.limits.stallMs,
        );
        const stall = new AbortController();
        const stopWatching = this.watchForStall(watch, stall, abortSignal);
        try {
            const apiKey = await this.resolveApiKey(prepared.userId, this.agent.requiresLocalApiKey());
            const input = await this.input(prepared, apiKey, stall.signal, attempt, grant.token, scopeToken);
            const result = await this.agent.converse(input, watch.wrap(sink.sink));
            await sink.flush();
            // 취소로 끊긴 턴은 아무 말도 못 받고 끝날 수 있고 그것은 실패가 아니다.
            if (result.text.trim().length === 0 && !abortSignal.aborted) {
                throw new Error("Chat turn produced no assistant response");
            }
            return { executionId: prepared.executionId, attempt, result: stalledIfCut(result, stall) };
        } finally {
            stopWatching();
            await sink.flush().catch(() => undefined);
            sink.close();
        }
    }

    /** 벽시계가 아니라 진행이 끊긴 것을 보고 끊으므로 느리지만 일하는 턴은 유지된다. */
    private watchForStall(watch: ChatStallWatch, stall: AbortController, parent: AbortSignal): () => void {
        const onParentAbort = (): void => stall.abort(parent.reason);
        if (parent.aborted) stall.abort(parent.reason);
        else parent.addEventListener("abort", onParentAbort, { once: true });
        let handle: object | null = null;
        const tick = (): void => {
            if (watch.isStalled()) {
                stall.abort(new ChatTurnStalledError());
                return;
            }
            handle = this.scheduler.schedule(STALL_POLL_MS, tick);
        };
        handle = this.scheduler.schedule(STALL_POLL_MS, tick);
        return () => {
            if (handle !== null) this.scheduler.cancel(handle);
            parent.removeEventListener("abort", onParentAbort);
        };
    }

    /** 이력과 요약과 기억은 접수의 재생 규칙 하나가 계산하며 이 워커는 실행 범위 자격으로 되읽는다. */
    private async input(
        prepared: PreparedChatExecution,
        apiKey: string | null,
        abortSignal: AbortSignal,
        attempt: number,
        draftToken: string,
        scopeToken: string | null,
    ): Promise<ChatTurnInput> {
        const common = {
            idempotencyKey: prepared.executionId,
            threadId: prepared.threadId,
            userId: prepared.userId,
            language: prepared.language,
            deadlineMs: CHAT_SPEC.limits.deadlineMs,
            attempt,
            draftToken,
            ...(scopeToken !== null ? { scopeToken } : {}),
            ...(prepared.model !== undefined ? { model: prepared.model } : {}),
            ...(apiKey !== null ? { apiKey } : {}),
            abortSignal,
        };
        const replay = await this.replayClients(prepared.userId, scopeToken ?? undefined).fetchReplay(
            prepared.threadId,
            prepared.executionId,
        );
        return {
            ...common,
            messages: replay.messages,
            summary: replay.summary,
            ...(replay.facts.length > 0 ? { facts: replay.facts } : {}),
        };
    }

    private async resolveApiKey(userId: string, required: boolean): Promise<string | null> {
        if (!required) return null;
        const value = await this.settings.findValue(userId, ANTHROPIC_API_KEY_SETTING);
        if (value === null || value.length === 0) throw new ChatMissingApiKeyError();
        return value;
    }
}

/** 진행이 끊겨 이 워커가 끊은 턴은 실행이 무엇이라 하든 멈춤으로 기록한다. */
function stalledIfCut(result: ChatTurnResult, stall: AbortController): ChatTurnResult {
    if (!(stall.signal.reason instanceof ChatTurnStalledError)) return result;
    return { ...result, stopReason: CHAT_STOP_REASON.stalled };
}
