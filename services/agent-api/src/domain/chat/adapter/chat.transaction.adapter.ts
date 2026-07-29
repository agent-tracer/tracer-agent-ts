import { Inject, Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import type { ChatTransactionPort, ChatTx } from "~agent-api/domain/chat/port/chat.transaction.port.js";
import { ChatExecutionEntity } from "./chat.execution.entity.js";
import { ChatExecutionStepEntity } from "./chat.execution.step.entity.js";
import { ChatMessageEntity } from "./chat.message.entity.js";
import { ChatPendingToolEntity } from "./chat.pending.tool.entity.js";
import { ChatThreadEntity } from "./chat.thread.entity.js";
import { TypeOrmChatExecutionRepository } from "./typeorm.chat.execution.repository.adapter.js";
import { TypeOrmChatExecutionStepRepository } from "./typeorm.chat.execution.step.repository.adapter.js";
import { TypeOrmChatMessageRepository } from "./typeorm.chat.message.repository.adapter.js";
import { TypeOrmChatPendingToolRepository } from "./typeorm.chat.pending.tool.repository.adapter.js";
import { TypeOrmChatThreadRepository } from "./typeorm.chat.thread.repository.adapter.js";

function bind(manager: EntityManager): ChatTx {
    return {
        chatExecutions: new TypeOrmChatExecutionRepository(manager.getRepository(ChatExecutionEntity)),
        chatExecutionSteps: new TypeOrmChatExecutionStepRepository(manager.getRepository(ChatExecutionStepEntity)),
        chatMessages: new TypeOrmChatMessageRepository(manager.getRepository(ChatMessageEntity)),
        chatPendingTools: new TypeOrmChatPendingToolRepository(manager.getRepository(ChatPendingToolEntity)),
        chatThreads: new TypeOrmChatThreadRepository(manager.getRepository(ChatThreadEntity)),
    };
}

/** 저장소가 생성자로 Repository를 받으므로 트랜잭션 매니저의 Repository로 같은 묶음을 다시 만든다. */
@Injectable()
export class ChatTransactionAdapter implements ChatTransactionPort {
    constructor(@Inject(AGENT_DATA_SOURCE) private readonly dataSource: DataSource) {}

    async run<T>(work: (tx: ChatTx) => Promise<T>): Promise<T> {
        return this.dataSource.transaction((manager) => work(bind(manager)));
    }
}
