import type { ChatSchedulerPort } from "~agent-worker/domain/chat/port/chat.execution.sink.port.js";

export class ChatScheduler implements ChatSchedulerPort {
    schedule(delayMs: number, callback: () => void): ReturnType<typeof setTimeout> {
        return setTimeout(callback, delayMs);
    }

    cancel(handle: object): void {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
    }
}
