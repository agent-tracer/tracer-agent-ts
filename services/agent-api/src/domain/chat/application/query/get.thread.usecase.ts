import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { mapThread, type ChatThreadDto } from "~agent-api/domain/chat/model/chat.model.js";
import {
    CHAT_THREAD_REPOSITORY,
    type ChatThreadRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";

/** 스레드 하나를 소유자에게만 준다. */
@Injectable()
export class GetThreadUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
    ) {}

    async execute(userId: string, threadId: string): Promise<{ readonly thread: ChatThreadDto }> {
        const thread = await this.threads.findById(threadId);
        if (thread === null || !thread.isOwnedBy(userId)) throw new NotFoundException("Thread not found");
        return { thread: mapThread(thread) };
    }
}
