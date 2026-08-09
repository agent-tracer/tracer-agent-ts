import { errorMessage, logInfo, logWarn, type IClock } from "@tracer-agent/platform";
import { ANTHROPIC_API_KEY_SETTING } from "~agent-worker/support/agent.const.js";
import { ChatMissingApiKeyError } from "~agent-worker/domain/chat/model/chat.errors.js";
import type { ChatMessage } from "~agent-worker/domain/chat/model/chat.message.model.js";
import {
    CHAT_SUMMARY_SYSTEM_PROMPT,
    renderChatSummaryPrompt,
} from "~agent-worker/domain/chat/model/chat.prompt.js";
import {
    selectMessagesToFold,
    shouldSummarize,
} from "~agent-worker/domain/chat/model/chat.summary.spec.js";
import type { ChatThread } from "~agent-worker/domain/chat/model/chat.thread.model.js";
import { toChatTurnMessage } from "~agent-worker/domain/chat/model/chat.turn.model.js";
import type { ChatThreadRepositoryPort } from "~agent-worker/domain/chat/port/chat.repository.port.js";
import type { ChatSummarizerPort } from "~agent-worker/domain/chat/port/chat.summarizer.port.js";
import type { ChatSettingReaderPort } from "~agent-worker/domain/chat/port/setting.reader.port.js";

/** 문턱을 넘은 스레드의 오래된 메시지를 요약에 접어 넣되 실패해도 턴을 막지 않는 단계다. */
export class SummarizeThreadProjection {
    constructor(
        private readonly threads: ChatThreadRepositoryPort,
        private readonly summarizer: ChatSummarizerPort,
        private readonly clock: IClock,
        private readonly settings: ChatSettingReaderPort,
    ) {}

    /** 러너가 자격을 요구하면 대화 턴과 같은 사용자 키로 실행한다. */
    private async apiKey(userId: string): Promise<string | null> {
        if (!this.summarizer.requiresLocalApiKey()) return null;
        const value = await this.settings.findValue(userId, ANTHROPIC_API_KEY_SETTING);
        if (value === null || value.length === 0) throw new ChatMissingApiKeyError();
        return value;
    }

    async project(thread: ChatThread, messages: readonly ChatMessage[]): Promise<void> {
        if (!shouldSummarize(messages)) return;
        const older = selectMessagesToFold(messages);
        if (older.length === 0) return;

        try {
            const apiKey = await this.apiKey(thread.userId);
            const summary = await this.summarizer.summarize({
                systemPrompt: CHAT_SUMMARY_SYSTEM_PROMPT,
                prompt: renderChatSummaryPrompt(older.map(toChatTurnMessage), thread.summary),
                ...(apiKey !== null ? { apiKey } : {}),
            });
            // 접은 마지막 메시지를 함께 적어야 읽는 쪽이 그 뒤부터 실어 빈 구간이 생기지 않는다.
            thread.updateSummary(summary.trim(), older[older.length - 1]!.id, this.clock.now());
            await this.threads.update(thread);
            logInfo({ msg: "chat.summary.updated", threadId: thread.id, foldedMessages: older.length });
        } catch (error) {
            logWarn({ msg: "chat.summary.failed", threadId: thread.id, error: errorMessage(error) });
        }
    }
}
