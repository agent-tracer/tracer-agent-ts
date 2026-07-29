import type { DataSource } from "typeorm";
import type { ChatTransactionPort, ChatTx } from "~agent-worker/domain/chat/port/chat.transaction.port.js";
import { AgentRunObservationEntity } from "./agent.run.observation.entity.js";
import { ChatExecutionEntity, ChatMessageEntity, ChatThreadEntity } from "./chat.entity.js";
import { ChatExecutionStepEntity } from "./chat.execution.step.entity.js";
import { TypeOrmChatExecutionRepository } from "./typeorm.chat.execution.repository.adapter.js";
import {
    TypeOrmAgentRunObservationRepository,
    TypeOrmChatExecutionStepRepository,
    TypeOrmChatMessageRepository,
    TypeOrmChatThreadRepository,
} from "./typeorm.chat.repository.adapter.js";

/** 종결이 관측과 원장과 메시지와 궤적을 한 트랜잭션으로 새긴다. */
export class ChatTransactionAdapter implements ChatTransactionPort {
    constructor(private readonly dataSource: DataSource) {}

    run<T>(work: (tx: ChatTx) => Promise<T>): Promise<T> {
        return this.dataSource.transaction((manager) =>
            work({
                agentRunObservations: new TypeOrmAgentRunObservationRepository(
                    manager.getRepository(AgentRunObservationEntity),
                ),
                chatExecutions: new TypeOrmChatExecutionRepository(manager.getRepository(ChatExecutionEntity)),
                chatExecutionSteps: new TypeOrmChatExecutionStepRepository(
                    manager.getRepository(ChatExecutionStepEntity),
                ),
                chatMessages: new TypeOrmChatMessageRepository(manager.getRepository(ChatMessageEntity)),
                chatThreads: new TypeOrmChatThreadRepository(manager.getRepository(ChatThreadEntity)),
            }),
        );
    }
}
