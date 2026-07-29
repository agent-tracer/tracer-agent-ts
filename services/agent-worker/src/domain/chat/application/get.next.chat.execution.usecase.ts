import type { ChatExecutionRepositoryPort } from "~agent-worker/domain/chat/port/chat.repository.port.js";

export class GetNextChatExecutionUsecase {
    constructor(private readonly executions: ChatExecutionRepositoryPort) {}

    async execute(threadId: string): Promise<string | null> {
        const queued = await this.executions.listQueuedByThread(threadId);
        return queued[0]?.id ?? null;
    }
}
