import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { mapMessage, type ChatMessageDto } from "~agent-api/domain/chat/model/chat.model.js";
import {
    CHAT_MESSAGE_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatMessageRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";

/** 스레드의 메시지를 쌓인 순서대로 소유자에게만 준다. */
@Injectable()
export class GetMessagesUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY)
        private readonly messages: ChatMessageRepositoryPort,
    ) {}

    async execute(userId: string, threadId: string): Promise<{ readonly items: readonly ChatMessageDto[] }> {
        const thread = await this.threads.findById(threadId);
        if (thread === null || !thread.isOwnedBy(userId)) throw new NotFoundException("Thread not found");
        const rows = await this.messages.listByThread(threadId);
        return { items: rows.map(mapMessage) };
    }
}
