import type { ChatExecutionStep } from "~agent-api/domain/chat/model/chat.execution.step.model.js";
import type { ChatExecutionStepRepositoryPort } from "~agent-api/domain/chat/port/chat.repository.port.js";

export class InMemoryChatExecutionStepRepository implements ChatExecutionStepRepositoryPort {
    private readonly rows = new Map<string, ChatExecutionStep>();

    seed(...steps: readonly ChatExecutionStep[]): void {
        for (const step of steps) this.rows.set(step.id, step);
    }

    findByExecutionId(executionId: string, userId: string): Promise<ChatExecutionStep[]> {
        const found = [...this.rows.values()]
            .filter((step) => step.executionId === executionId && step.userId === userId)
            .sort((left, right) => left.attempt - right.attempt || left.seq - right.seq);
        return Promise.resolve(found);
    }

    deleteByExecutionIds(executionIds: readonly string[]): Promise<void> {
        const targets = new Set(executionIds);
        for (const [id, step] of [...this.rows]) {
            if (targets.has(step.executionId)) this.rows.delete(id);
        }
        return Promise.resolve();
    }
}
