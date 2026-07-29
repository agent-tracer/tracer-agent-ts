import { Inject, Injectable } from "@nestjs/common";
import { mapThread, type ChatThreadDto } from "~agent-api/domain/chat/model/chat.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { CHAT_ID_GENERATOR, type ChatIdGeneratorPort } from "~agent-api/domain/chat/port/chat.id.generator.port.js";
import {
    CHAT_THREAD_REPOSITORY,
    type ChatThreadRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";
import { CHAT_CLOCK, type ClockPort } from "~agent-api/domain/chat/port/clock.port.js";

export interface CreateThreadInput {
    readonly userId: string;
    readonly title: string;
}

/** 새 대화 스레드를 연다. */
@Injectable()
export class CreateThreadUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
        @Inject(CHAT_ID_GENERATOR)
        private readonly ids: ChatIdGeneratorPort,
    ) {}

    async execute(input: CreateThreadInput): Promise<{ readonly thread: ChatThreadDto }> {
        const thread = ChatThread.create({
            id: this.ids.next(),
            userId: input.userId,
            title: input.title,
            now: this.clock.now(),
        });
        await this.threads.create(thread);
        return { thread: mapThread(thread) };
    }
}
