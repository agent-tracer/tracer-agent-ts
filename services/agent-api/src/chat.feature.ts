import { loadApplicationConfig, SystemClock } from "@tracer-agent/platform";
import { TracerApiClient } from "@tracer-agent/tracer-client";
import type { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import { ChatDraftTokenAdapter } from "~agent-api/domain/chat/adapter/chat.draft.token.adapter.js";
import { ChatExecutionEvents } from "~agent-api/domain/chat/adapter/chat.execution.events.js";
import { ChatExecutionUpdatePublisher } from "~agent-api/domain/chat/adapter/chat.execution.update.publisher.js";
import { ChatScopeTokenAdapter } from "~agent-api/domain/chat/adapter/chat.scope.token.adapter.js";
import { ChatTransactionAdapter } from "~agent-api/domain/chat/adapter/chat.transaction.adapter.js";
import { buildChatToolExecutors } from "~agent-api/domain/chat/adapter/chat.tool.executors.adapter.js";
import { ChatUlidGenerator } from "~agent-api/domain/chat/adapter/chat.ulid.generator.js";
import { ChatWorkflowDispatcher } from "~agent-api/domain/chat/adapter/chat.workflow.dispatcher.js";
import { ChatExecutionEntity } from "~agent-api/domain/chat/adapter/chat.execution.entity.js";
import { ChatExecutionStepEntity } from "~agent-api/domain/chat/adapter/chat.execution.step.entity.js";
import { ChatMessageEntity } from "~agent-api/domain/chat/adapter/chat.message.entity.js";
import { ChatPendingToolEntity } from "~agent-api/domain/chat/adapter/chat.pending.tool.entity.js";
import { ChatThreadEntity } from "~agent-api/domain/chat/adapter/chat.thread.entity.js";
import { ChatUserMemoryEntity } from "~agent-api/domain/chat/adapter/chat.user.memory.entity.js";
import { TypeOrmChatExecutionRepository } from "~agent-api/domain/chat/adapter/typeorm.chat.execution.repository.adapter.js";
import { TypeOrmChatExecutionStepRepository } from "~agent-api/domain/chat/adapter/typeorm.chat.execution.step.repository.adapter.js";
import { TypeOrmChatMessageRepository } from "~agent-api/domain/chat/adapter/typeorm.chat.message.repository.adapter.js";
import { TypeOrmChatPendingToolRepository } from "~agent-api/domain/chat/adapter/typeorm.chat.pending.tool.repository.adapter.js";
import { TypeOrmChatThreadRepository } from "~agent-api/domain/chat/adapter/typeorm.chat.thread.repository.adapter.js";
import { TypeOrmChatUserMemoryRepository } from "~agent-api/domain/chat/adapter/typeorm.chat.user.memory.repository.adapter.js";
import { AppendUserMessageUseCase } from "~agent-api/domain/chat/application/command/append.user.message.usecase.js";
import { CancelChatExecutionUseCase } from "~agent-api/domain/chat/application/command/cancel.chat.execution.usecase.js";
import { CheckpointChatDraftUseCase } from "~agent-api/domain/chat/application/command/checkpoint.chat.draft.usecase.js";
import { ConfirmToolUseCase } from "~agent-api/domain/chat/application/command/confirm.tool.usecase.js";
import { CreateThreadUseCase } from "~agent-api/domain/chat/application/command/create.thread.usecase.js";
import { DeleteThreadUseCase } from "~agent-api/domain/chat/application/command/delete.thread.usecase.js";
import { EnqueueChatTurnUseCase } from "~agent-api/domain/chat/application/command/enqueue.chat.turn.usecase.js";
import { IssueChatExecutionEnvelopeUseCase } from "~agent-api/domain/chat/application/command/issue.chat.execution.envelope.usecase.js";
import { ProposeToolUseCase } from "~agent-api/domain/chat/application/command/propose.tool.usecase.js";
import { RememberFactUseCase } from "~agent-api/domain/chat/application/command/remember.fact.usecase.js";
import { RenameThreadUseCase } from "~agent-api/domain/chat/application/command/rename.thread.usecase.js";
import { GetChatExecutionStepsUseCase } from "~agent-api/domain/chat/application/query/get.chat.execution.steps.usecase.js";
import { GetChatReplayUseCase } from "~agent-api/domain/chat/application/query/get.chat.replay.usecase.js";
import { GetMessagesUseCase } from "~agent-api/domain/chat/application/query/get.messages.usecase.js";
import { GetThreadUseCase } from "~agent-api/domain/chat/application/query/get.thread.usecase.js";
import { ListChatExecutionsUseCase } from "~agent-api/domain/chat/application/query/list.chat.executions.usecase.js";
import { ListThreadsUseCase } from "~agent-api/domain/chat/application/query/list.threads.usecase.js";
import { RecallFactsUseCase } from "~agent-api/domain/chat/application/query/recall.facts.usecase.js";
import { WatchChatExecutionUseCase } from "~agent-api/domain/chat/application/query/watch.chat.execution.usecase.js";
import { ChatConfirmationController } from "~agent-api/domain/chat/inbound/chat.confirmation.controller.js";
import { ChatStreamController } from "~agent-api/domain/chat/inbound/chat.stream.controller.js";
import { ChatThreadController } from "~agent-api/domain/chat/inbound/chat.thread.controller.js";
import { ChatTurnController } from "~agent-api/domain/chat/inbound/chat.turn.controller.js";
import { ChatDraftController } from "~agent-api/domain/chat/inbound/chat.draft.controller.js";
import { ChatInternalController } from "~agent-api/domain/chat/inbound/chat.internal.controller.js";
import { ChatMemoryController } from "~agent-api/domain/chat/inbound/chat.memory.controller.js";
import { CHAT_DRAFT_TOKEN } from "~agent-api/domain/chat/port/chat.draft.token.port.js";
import { CHAT_EXECUTION_DISPATCHER } from "~agent-api/domain/chat/port/chat.execution.dispatcher.port.js";
import {
    CHAT_EXECUTION_UPDATE_PUBLISHER,
    CHAT_EXECUTION_UPDATE_SUBSCRIBER,
} from "~agent-api/domain/chat/port/chat.execution.update.port.js";
import { CHAT_ID_GENERATOR } from "~agent-api/domain/chat/port/chat.id.generator.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_EXECUTION_STEP_REPOSITORY,
    CHAT_MESSAGE_REPOSITORY,
    CHAT_PENDING_TOOL_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    CHAT_USER_MEMORY_REPOSITORY,
} from "~agent-api/domain/chat/port/chat.repository.port.js";
import { CHAT_SCOPE_TOKEN } from "~agent-api/domain/chat/port/chat.scope.token.port.js";
import { CHAT_TOOL_EXECUTORS } from "~agent-api/domain/chat/port/chat.tool.executors.port.js";
import {
    CHAT_AGENT_API_BASE_URL,
    CHAT_TRACER_API_BASE_URL,
} from "~agent-api/domain/chat/port/chat.tracer.api.port.js";
import { CHAT_TRANSACTION } from "~agent-api/domain/chat/port/chat.transaction.port.js";
import { CHAT_CLOCK } from "~agent-api/domain/chat/port/clock.port.js";
import { CHAT_SETTING_READER } from "~agent-api/domain/chat/port/setting.reader.port.js";
import { SETTING_REPOSITORY } from "~agent-api/domain/settings/port/setting.repository.port.js";

/** 도구가 기록을 읽고 되돌려 보내는 추적 API의 기점이다. */
function resolveTracerApiBaseUrl(): string {
    return process.env["TRACER_API_URL"] ?? "http://127.0.0.1:3902";
}

/** 실행기가 draft를 통지하러 되돌아오는 이 서비스의 기점이다. */
function resolveAgentApiBaseUrl(): string {
    return process.env["AGENT_API_URL"] ?? `http://127.0.0.1:${loadApplicationConfig().agentApi.port}`;
}

/** chat 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const chatFeature = {
    controllers: [
        ChatThreadController,
        ChatTurnController,
        ChatStreamController,
        ChatConfirmationController,
        ChatDraftController,
        ChatMemoryController,
        ChatInternalController,
    ],
    providers: [
        AppendUserMessageUseCase,
        CancelChatExecutionUseCase,
        CheckpointChatDraftUseCase,
        ConfirmToolUseCase,
        CreateThreadUseCase,
        DeleteThreadUseCase,
        EnqueueChatTurnUseCase,
        IssueChatExecutionEnvelopeUseCase,
        ProposeToolUseCase,
        RememberFactUseCase,
        RenameThreadUseCase,
        GetChatExecutionStepsUseCase,
        GetChatReplayUseCase,
        GetMessagesUseCase,
        GetThreadUseCase,
        ListChatExecutionsUseCase,
        ListThreadsUseCase,
        RecallFactsUseCase,
        WatchChatExecutionUseCase,
        ChatDraftTokenAdapter,
        { provide: CHAT_DRAFT_TOKEN, useExisting: ChatDraftTokenAdapter },
        ChatScopeTokenAdapter,
        { provide: CHAT_SCOPE_TOKEN, useExisting: ChatScopeTokenAdapter },
        ChatExecutionEvents,
        { provide: CHAT_EXECUTION_UPDATE_SUBSCRIBER, useExisting: ChatExecutionEvents },
        ChatExecutionUpdatePublisher,
        { provide: CHAT_EXECUTION_UPDATE_PUBLISHER, useExisting: ChatExecutionUpdatePublisher },
        ChatWorkflowDispatcher,
        { provide: CHAT_EXECUTION_DISPATCHER, useExisting: ChatWorkflowDispatcher },
        ChatTransactionAdapter,
        { provide: CHAT_TRANSACTION, useExisting: ChatTransactionAdapter },
        { provide: CHAT_SETTING_READER, useExisting: SETTING_REPOSITORY },
        { provide: CHAT_CLOCK, useClass: SystemClock },
        ChatUlidGenerator,
        { provide: CHAT_ID_GENERATOR, useExisting: ChatUlidGenerator },
        {
            provide: CHAT_THREAD_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) => new TypeOrmChatThreadRepository(source.getRepository(ChatThreadEntity)),
        },
        {
            provide: CHAT_MESSAGE_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) => new TypeOrmChatMessageRepository(source.getRepository(ChatMessageEntity)),
        },
        {
            provide: CHAT_EXECUTION_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) => new TypeOrmChatExecutionRepository(source.getRepository(ChatExecutionEntity)),
        },
        {
            provide: CHAT_EXECUTION_STEP_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) => new TypeOrmChatExecutionStepRepository(source.getRepository(ChatExecutionStepEntity)),
        },
        {
            provide: CHAT_PENDING_TOOL_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) => new TypeOrmChatPendingToolRepository(source.getRepository(ChatPendingToolEntity)),
        },
        {
            provide: CHAT_USER_MEMORY_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) => new TypeOrmChatUserMemoryRepository(source.getRepository(ChatUserMemoryEntity)),
        },
        { provide: CHAT_TRACER_API_BASE_URL, useFactory: resolveTracerApiBaseUrl },
        { provide: CHAT_AGENT_API_BASE_URL, useFactory: resolveAgentApiBaseUrl },
        {
            provide: CHAT_TOOL_EXECUTORS,
            inject: [CHAT_TRACER_API_BASE_URL, CHAT_AGENT_API_BASE_URL],
            useFactory: (tracerBaseUrl: string, agentBaseUrl: string) =>
                buildChatToolExecutors(new TracerApiClient(tracerBaseUrl), new TracerApiClient(agentBaseUrl)),
        },
    ],
};

/** 대화 원장의 표를 비추는 엔티티다. */
export const CHAT_ENTITIES = [
    ChatThreadEntity,
    ChatMessageEntity,
    ChatExecutionEntity,
    ChatExecutionStepEntity,
    ChatPendingToolEntity,
    ChatUserMemoryEntity,
] as const;
