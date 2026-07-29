import type { QueryDeepPartialEntity, Repository } from "typeorm";
import type { ChatMessage } from "~agent-worker/domain/chat/model/chat.message.model.js";
import type { ChatThread } from "~agent-worker/domain/chat/model/chat.thread.model.js";
import type {
    ChatExecutionStepRecord,
    ChatExecutionStepRepositoryPort,
    ChatMessageRepositoryPort,
    ChatThreadRepositoryPort,
} from "~agent-worker/domain/chat/port/chat.repository.port.js";
import type {
    ChatMessageEntity,
    ChatThreadEntity} from "./chat.entity.js";
import {
    toChatMessage,
    toChatMessageRow,
    toChatThread,
    toChatThreadRow,
} from "./chat.entity.js";
import type { ChatExecutionStepEntity} from "./chat.execution.step.entity.js";
import { toChatExecutionStepRow } from "./chat.execution.step.entity.js";

export class TypeOrmChatThreadRepository implements ChatThreadRepositoryPort {
    constructor(private readonly repo: Repository<ChatThreadEntity>) {}

    async findById(id: string): Promise<ChatThread | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row === null ? null : toChatThread(row);
    }

    async update(thread: ChatThread): Promise<void> {
        await this.repo.save(toChatThreadRow(thread));
    }
}

export class TypeOrmChatMessageRepository implements ChatMessageRepositoryPort {
    constructor(private readonly repo: Repository<ChatMessageEntity>) {}

    async append(message: ChatMessage): Promise<void> {
        await this.repo.insert(
            toChatMessageRow(message) as unknown as QueryDeepPartialEntity<ChatMessageEntity>,
        );
    }

    async listByThread(threadId: string): Promise<ChatMessage[]> {
        const rows = await this.repo.find({ where: { threadId }, order: { createdAt: "ASC", id: "ASC" } });
        return rows.map(toChatMessage);
    }
}

export class TypeOrmChatExecutionStepRepository implements ChatExecutionStepRepositoryPort {
    constructor(private readonly repo: Repository<ChatExecutionStepEntity>) {}

    async insertMany(steps: readonly ChatExecutionStepRecord[]): Promise<void> {
        if (steps.length === 0) return;
        await this.repo.insert(
            steps.map(toChatExecutionStepRow) as unknown as QueryDeepPartialEntity<ChatExecutionStepEntity>[],
        );
    }
}
