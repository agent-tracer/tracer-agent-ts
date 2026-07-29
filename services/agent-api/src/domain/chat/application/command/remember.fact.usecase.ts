import { Inject, Injectable } from "@nestjs/common";
import { ChatUserMemory } from "~agent-api/domain/chat/model/chat.user.memory.model.js";
import { CHAT_ID_GENERATOR, type ChatIdGeneratorPort } from "~agent-api/domain/chat/port/chat.id.generator.port.js";
import {
    CHAT_USER_MEMORY_REPOSITORY,
    type ChatUserMemoryRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";
import { CHAT_CLOCK, type ClockPort } from "~agent-api/domain/chat/port/clock.port.js";

export interface RememberFactInput {
    readonly userId: string;
    readonly key: string;
    readonly content: string;
}

export interface RememberedFactDto {
    readonly key: string;
    readonly content: string;
    readonly status: "remembered";
}

/** remember_fact 도구가 부르는, 확인 게이트 없이 즉시 upsert하는 사용자 장기기억 쓰기다. */
@Injectable()
export class RememberFactUseCase {
    constructor(
        @Inject(CHAT_USER_MEMORY_REPOSITORY)
        private readonly memories: ChatUserMemoryRepositoryPort,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
        @Inject(CHAT_ID_GENERATOR)
        private readonly ids: ChatIdGeneratorPort,
    ) {}

    async execute(input: RememberFactInput): Promise<RememberedFactDto> {
        const memory = ChatUserMemory.create({
            id: this.ids.next(),
            userId: input.userId,
            key: input.key,
            content: input.content,
            now: this.clock.now(),
        });
        await this.memories.upsert(memory);
        return { key: input.key, content: input.content, status: "remembered" };
    }
}
