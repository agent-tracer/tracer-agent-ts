import type { ChatIdGeneratorPort } from "~agent-api/domain/chat/port/chat.id.generator.port.js";

/** 식별자 포트의 대역이며 실물의 ULID 와 달리 열 번째부터는 사전순이 만든 순서와 어긋난다. */
export class SequentialChatIdGenerator implements ChatIdGeneratorPort {
    private position = 0;

    constructor(private readonly prefix = "chat-id") {}

    next(): string {
        this.position += 1;
        return `${this.prefix}-${this.position}`;
    }
}
