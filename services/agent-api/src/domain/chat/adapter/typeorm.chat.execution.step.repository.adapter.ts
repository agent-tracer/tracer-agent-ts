import { In, type Repository } from "typeorm";
import type { ChatExecutionStep } from "~agent-api/domain/chat/model/chat.execution.step.model.js";
import type { ChatExecutionStepRepositoryPort } from "~agent-api/domain/chat/port/chat.repository.port.js";
import { toChatExecutionStep, type ChatExecutionStepEntity } from "./chat.execution.step.entity.js";

export class TypeOrmChatExecutionStepRepository implements ChatExecutionStepRepositoryPort {
    constructor(private readonly repo: Repository<ChatExecutionStepEntity>) {}

    async findByExecutionId(executionId: string, userId: string): Promise<ChatExecutionStep[]> {
        const rows = await this.repo.find({
            where: { executionId, userId },
            order: { attempt: "ASC", seq: "ASC" },
        });
        return rows.map(toChatExecutionStep);
    }

    async deleteByExecutionIds(executionIds: readonly string[]): Promise<void> {
        if (executionIds.length === 0) return;
        await this.repo.delete({ executionId: In([...executionIds]) });
    }
}
