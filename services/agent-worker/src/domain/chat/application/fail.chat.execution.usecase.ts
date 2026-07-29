import type { IClock } from "@tracer-agent/platform";
import type { ChatExecutionUpdatePublisherPort } from "~agent-worker/domain/chat/port/chat.execution.sink.port.js";
import type { ChatExecutionRepositoryPort } from "~agent-worker/domain/chat/port/chat.repository.port.js";

export class FailChatExecutionUsecase {
    constructor(
        private readonly executions: ChatExecutionRepositoryPort,
        private readonly clock: IClock,
        private readonly events: ChatExecutionUpdatePublisherPort,
    ) {}

    async execute(executionId: string, error: string): Promise<void> {
        if (await this.executions.failActive(executionId, error, this.clock.now())) {
            this.events.publish(executionId);
        }
    }
}
