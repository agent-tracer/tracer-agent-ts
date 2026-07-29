import { Inject, Injectable } from "@nestjs/common";
import { generateUlid } from "@tracer-agent/platform";
import type { ChatIdGeneratorPort } from "~agent-api/domain/chat/port/chat.id.generator.port.js";
import { CHAT_CLOCK, type ClockPort } from "~agent-api/domain/chat/port/clock.port.js";

@Injectable()
export class ChatUlidGenerator implements ChatIdGeneratorPort {
    constructor(@Inject(CHAT_CLOCK) private readonly clock: ClockPort) {}

    next(): string {
        return generateUlid(this.clock.now().getTime());
    }
}
