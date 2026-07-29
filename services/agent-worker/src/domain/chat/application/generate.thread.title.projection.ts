import { errorMessage, logInfo, logWarn, type IClock } from "@tracer-agent/platform";
import { ANTHROPIC_API_KEY_SETTING } from "~agent-worker/support/agent.const.js";
import { ChatMissingApiKeyError } from "~agent-worker/domain/chat/model/chat.errors.js";
import type { ChatMessage } from "~agent-worker/domain/chat/model/chat.message.model.js";
import {
    CHAT_TITLE_SYSTEM_PROMPT,
    renderChatTitlePrompt,
} from "~agent-worker/domain/chat/model/chat.prompt.js";
import type { ChatThread } from "~agent-worker/domain/chat/model/chat.thread.model.js";
import {
    CHAT_DEFAULT_THREAD_TITLE,
    CHAT_TITLE_MAX_LENGTH,
} from "~agent-worker/domain/chat/model/chat.title.spec.js";
import { toChatTurnMessage } from "~agent-worker/domain/chat/model/chat.turn.model.js";
import type { ChatThreadRepositoryPort } from "~agent-worker/domain/chat/port/chat.repository.port.js";
import type { ChatSummarizerPort } from "~agent-worker/domain/chat/port/chat.summarizer.port.js";
import type { ChatSettingReaderPort } from "~agent-worker/domain/chat/port/setting.reader.port.js";

/** 기본 제목 그대로인 스레드에만 짧은 제목을 붙이되 실패해도 턴을 막지 않는 단계다. */
export class GenerateThreadTitleProjection {
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
        if (thread.title !== CHAT_DEFAULT_THREAD_TITLE) return;

        try {
            const apiKey = await this.apiKey(thread.userId);
            const title = await this.summarizer.summarize({
                systemPrompt: CHAT_TITLE_SYSTEM_PROMPT,
                prompt: renderChatTitlePrompt(messages.map(toChatTurnMessage)),
                ...(apiKey !== null ? { apiKey } : {}),
            });
            const trimmed = title.trim().slice(0, CHAT_TITLE_MAX_LENGTH);
            if (trimmed.length === 0) return;

            thread.rename(trimmed, this.clock.now());
            await this.threads.update(thread);
            logInfo({ msg: "chat.title.generated", threadId: thread.id, title: trimmed });
        } catch (error) {
            logWarn({ msg: "chat.title.failed", threadId: thread.id, error: errorMessage(error) });
        }
    }
}
