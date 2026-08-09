import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { logWarn } from "@tracer-agent/platform";
import { buildChatReplay } from "~agent-api/domain/chat/model/chat.replay.js";
import { CHAT_REPLAY_MAX_MESSAGES } from "~agent-api/domain/chat/model/chat.replay.spec.js";
import type { ChatTurnMessage, ChatUserFact } from "~agent-api/domain/chat/model/chat.turn.model.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_MESSAGE_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    CHAT_USER_MEMORY_REPOSITORY,
    type ChatExecutionRepositoryPort,
    type ChatMessageRepositoryPort,
    type ChatThreadRepositoryPort,
    type ChatUserMemoryRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";

/** 한 대화 턴이 모델에게 되돌려 줄 이력과 요약과 기억이며, 어느 구현체가 실행하든 같은 값이다. */
export interface ChatReplay {
    readonly messages: readonly ChatTurnMessage[];
    readonly summary: string | null;
    readonly facts: readonly ChatUserFact[];
}

/** 대화 재생을 소유자에게만 계산해 주며, 창 크기도 도구 호출 짝 맞추기도 서버가 한 번만 판단한다. */
@Injectable()
export class GetChatReplayUseCase {
    constructor(
        @Inject(CHAT_EXECUTION_REPOSITORY)
        private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY)
        private readonly messages: ChatMessageRepositoryPort,
        @Inject(CHAT_USER_MEMORY_REPOSITORY)
        private readonly memories: ChatUserMemoryRepositoryPort,
    ) {}

    /** 어디까지가 이력인지는 실행 행이 알고 있으므로 부르는 쪽은 실행 식별자만 든다. */
    async execute(userId: string, threadId: string, executionId: string): Promise<ChatReplay> {
        const execution = await this.executions.findById(executionId);
        // 남의 스레드에 걸린 실행은 존재 자체를 알리지 않는다.
        if (execution === null || execution.userId !== userId || execution.threadId !== threadId) {
            throw new NotFoundException("Chat execution not found");
        }
        // 실행 행에 매인 id만 모으면 승인이 적재한 도구 결과가 어느 실행에도 안 매여 통째로 빠진다.
        const [thread, rows, facts] = await Promise.all([
            this.threads.findById(threadId),
            this.messages.listByThread(threadId),
            this.memories.listByUser(userId),
        ]);
        if (thread === null || !thread.isOwnedBy(userId)) throw new NotFoundException("Thread not found");
        const messages = buildChatReplay(rows, execution.replayAnchorMessageId, thread.summaryThroughMessageId);
        // 정상 흐름은 이 상한에 닿지 않으므로 닿았다는 것은 요약이 여러 번 실패했다는 신호다.
        if (messages.length >= CHAT_REPLAY_MAX_MESSAGES) {
            logWarn({
                msg: "chat.replay.truncated",
                threadId,
                executionId,
                kept: messages.length,
                stored: rows.length,
            });
        }
        return {
            messages,
            summary: thread.summary,
            facts: facts.map(({ key, content }) => ({ key, content })),
        };
    }
}
