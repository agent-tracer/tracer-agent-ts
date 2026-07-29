import type { ChatIdGeneratorPort } from "~agent-api/domain/chat/port/chat.id.generator.port.js";

export class SequentialChatIdGenerator implements ChatIdGeneratorPort {
    private position = 0;

    constructor(private readonly prefix = "chat-id") {}

    next(): string {
        this.position += 1;
        return `${this.prefix}-${this.position}`;
    }
}
