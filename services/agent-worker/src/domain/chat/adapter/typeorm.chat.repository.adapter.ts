import type { AgentRunObservation } from "@tracer-agent/llm";
import type { QueryDeepPartialEntity, Repository } from "typeorm";
import type { ChatMessage } from "~agent-worker/domain/chat/model/chat.message.model.js";
import type { ChatThread } from "~agent-worker/domain/chat/model/chat.thread.model.js";
import type {
    AgentRunObservationRepositoryPort,
    ChatExecutionStepRecord,
    ChatExecutionStepRepositoryPort,
    ChatMessageRepositoryPort,
    ChatThreadRepositoryPort,
} from "~agent-worker/domain/chat/port/chat.repository.port.js";
import {
    AgentRunObservationEntity,
    toAgentRunObservationRow,
} from "./agent.run.observation.entity.js";
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

export class TypeOrmAgentRunObservationRepository implements AgentRunObservationRepositoryPort {
    constructor(private readonly repo: Repository<AgentRunObservationEntity>) {}

    /** 같은 시도의 관측은 한 번만 새기며 이미 있으면 덮지 않는다. */
    async record(userId: string, observation: AgentRunObservation, now: Date): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .insert()
            .into(AgentRunObservationEntity)
            .values(
                toAgentRunObservationRow(userId, observation, now) as unknown as
                    QueryDeepPartialEntity<AgentRunObservationEntity>,
            )
            .orIgnore()
            .execute();
        return (result.identifiers[0] ?? null) !== null;
    }
}
