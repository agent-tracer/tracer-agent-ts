import { generateUlid, type IClock } from "@tracer-agent/platform";
import type { ChatIdGeneratorPort } from "~agent-worker/domain/chat/port/chat.id.generator.port.js";

/** 궤적 한 줄마다 시간 순서가 보존되는 식별자를 붙인다. */
export class ChatUlidGenerator implements ChatIdGeneratorPort {
    constructor(private readonly clock: IClock) {}

    next(): string {
        return generateUlid(this.clock.nowMs());
    }
}
