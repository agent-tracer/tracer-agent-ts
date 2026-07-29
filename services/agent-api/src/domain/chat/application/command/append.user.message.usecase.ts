import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CHAT_MESSAGE_ROLE } from "~agent-api/domain/chat/model/chat.const.js";
import { ChatMessage } from "~agent-api/domain/chat/model/chat.message.model.js";
import { mapMessage, type ChatMessageDto } from "~agent-api/domain/chat/model/chat.model.js";
import { CHAT_ID_GENERATOR, type ChatIdGeneratorPort } from "~agent-api/domain/chat/port/chat.id.generator.port.js";
import {
    CHAT_MESSAGE_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatMessageRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";
import { CHAT_CLOCK, type ClockPort } from "~agent-api/domain/chat/port/clock.port.js";

export interface AppendUserMessageInput {
    readonly userId: string;
    readonly threadId: string;
    readonly content: string;
}

/** 사용자가 보낸 메시지를 스레드에 적재하며, 소유하지 않은 스레드면 거절한다. */
@Injectable()
export class AppendUserMessageUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY)
        private readonly messages: ChatMessageRepositoryPort,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
        @Inject(CHAT_ID_GENERATOR)
        private readonly ids: ChatIdGeneratorPort,
    ) {}

    async execute(input: AppendUserMessageInput): Promise<{ readonly message: ChatMessageDto }> {
        const thread = await this.threads.findById(input.threadId);
        if (thread === null || !thread.isOwnedBy(input.userId)) throw new NotFoundException("Thread not found");

        const message = ChatMessage.create({
            id: this.ids.next(),
            threadId: input.threadId,
            role: CHAT_MESSAGE_ROLE.user,
            content: input.content,
            now: this.clock.now(),
        });
        await this.messages.append(message);
        return { message: mapMessage(message) };
    }
}
