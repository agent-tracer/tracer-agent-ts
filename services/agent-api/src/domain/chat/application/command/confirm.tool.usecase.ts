import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { logInfo } from "@tracer-agent/platform";
import { CHAT_MESSAGE_ROLE } from "~agent-api/domain/chat/model/chat.const.js";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { ChatMessage } from "~agent-api/domain/chat/model/chat.message.model.js";
import { mapExecution, type ChatExecutionDto } from "~agent-api/domain/chat/model/chat.model.js";
import {
    CHAT_EXECUTION_DISPATCHER,
    type ChatExecutionDispatcherPort,
} from "~agent-api/domain/chat/port/chat.execution.dispatcher.port.js";
import {
    CHAT_EXECUTION_UPDATE_PUBLISHER,
    type ChatExecutionUpdatePublisherPort,
} from "~agent-api/domain/chat/port/chat.execution.update.port.js";
import { CHAT_ID_GENERATOR, type ChatIdGeneratorPort } from "~agent-api/domain/chat/port/chat.id.generator.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_MESSAGE_REPOSITORY,
    CHAT_PENDING_TOOL_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatExecutionRepositoryPort,
    type ChatMessageRepositoryPort,
    type ChatPendingToolRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";
import {
    CHAT_TOOL_EXECUTORS,
    type ChatToolExecutorRegistry,
} from "~agent-api/domain/chat/port/chat.tool.executors.port.js";
import { CHAT_CLOCK, type ClockPort } from "~agent-api/domain/chat/port/clock.port.js";

export const CHAT_CONFIRM_DECISION = {
    approve: "approve",
    reject: "reject",
} as const;

export type ChatConfirmDecision = (typeof CHAT_CONFIRM_DECISION)[keyof typeof CHAT_CONFIRM_DECISION];

export interface ConfirmToolInput {
    readonly userId: string;
    readonly threadId: string;
    readonly confirmationId: string;
    readonly decision: ChatConfirmDecision;
}

export interface ConfirmToolResult {
    readonly confirmationId: string;
    readonly toolName: string;
    readonly status: string;
    readonly result: string;
    /** 승인이 세운 후속 턴이며 거절이거나 스레드가 이미 바쁘면 비어 있다. */
    readonly execution: ChatExecutionDto | null;
}

/** 대기 중인 쓰기 도구 하나를 승인이나 거절로 해소하고, 승인이면 실제로 실행해 결과를 대화에 남긴다. */
@Injectable()
export class ConfirmToolUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY)
        private readonly messages: ChatMessageRepositoryPort,
        @Inject(CHAT_PENDING_TOOL_REPOSITORY)
        private readonly pendingTools: ChatPendingToolRepositoryPort,
        @Inject(CHAT_TOOL_EXECUTORS)
        private readonly executors: ChatToolExecutorRegistry,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
        @Inject(CHAT_ID_GENERATOR)
        private readonly ids: ChatIdGeneratorPort,
        @Inject(CHAT_EXECUTION_REPOSITORY)
        private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_EXECUTION_UPDATE_PUBLISHER)
        private readonly events: ChatExecutionUpdatePublisherPort,
        @Inject(CHAT_EXECUTION_DISPATCHER)
        private readonly dispatcher: ChatExecutionDispatcherPort,
    ) {}

    async execute(input: ConfirmToolInput): Promise<ConfirmToolResult> {
        const thread = await this.threads.findById(input.threadId);
        if (thread === null || !thread.isOwnedBy(input.userId)) throw new NotFoundException("Thread not found");

        const pending = await this.pendingTools.findById(input.confirmationId);
        // 남의 스레드에 걸린 확인은 존재 자체를 알리지 않는다.
        if (pending === null || pending.threadId !== input.threadId) throw new NotFoundException("Confirmation not found");
        if (!pending.isPending()) throw new ConflictException("Confirmation already resolved");

        const now = this.clock.now();
        if (input.decision === CHAT_CONFIRM_DECISION.reject) {
            const content = `User rejected the proposed ${pending.toolName}. It was not executed.`;
            pending.reject(now);
            await this.pendingTools.resolve(pending);
            await this.appendToolMessage(input.threadId, pending.id, content, now);
            await this.announce(input.threadId);
            logInfo({ msg: "chat.tool.rejected", threadId: input.threadId, userId: input.userId, confirmationId: pending.id, toolName: pending.toolName });
            // 하지 말라고 이미 답한 자리라 이어 말할 턴을 세우지 않는다.
            return { confirmationId: pending.id, toolName: pending.toolName, status: pending.status, result: content, execution: null };
        }

        const executor = this.executors[pending.toolName];
        if (executor === undefined) throw new BadRequestException(`No executor for tool ${pending.toolName}`);
        // 실행이 먼저 성공해야 승인으로 전이하며, 실패하면 대기 행이 남아 재시도할 수 있다.
        const result = await executor(input.userId, pending.args);
        pending.approve(now);
        await this.pendingTools.resolve(pending);
        const anchorMessageId = await this.appendToolMessage(input.threadId, pending.id, result, now);
        const execution = await this.followUp(input, anchorMessageId, now);
        await this.announce(input.threadId);
        logInfo({ msg: "chat.tool.confirmed", threadId: input.threadId, userId: input.userId, confirmationId: pending.id, toolName: pending.toolName });
        return {
            confirmationId: pending.id,
            toolName: pending.toolName,
            status: pending.status,
            result,
            execution: execution === null ? null : mapExecution(execution),
        };
    }

    /** 실행한 결과를 모델이 읽고 이어 말하도록 그 결과를 앵커로 삼는 턴을 세운다. */
    private async followUp(
        input: ConfirmToolInput,
        anchorMessageId: string,
        now: Date,
    ): Promise<ChatExecution | null> {
        // 이미 도는 턴이 있으면 그 턴이 결과를 이력으로 읽으므로 줄을 하나 더 세우지 않는다.
        if ((await this.executions.findLatestActiveByThread(input.threadId)) !== null) return null;
        const [previous] = await this.executions.listByThread(input.threadId, 1);
        const execution = ChatExecution.createFollowUp({
            id: this.ids.next(),
            userId: input.userId,
            threadId: input.threadId,
            confirmationId: input.confirmationId,
            replayAnchorMessageId: anchorMessageId,
            model: previous?.model ?? null,
            language: previous?.language ?? null,
            now,
        });
        await this.executions.insert(execution);
        await this.dispatcher.start(execution.id, execution.threadId);
        return execution;
    }

    /** 확인 대기는 스레드 것이므로 지금 열려 있는 실행 채널에 실어 다른 탭과 replica가 해소를 본다. */
    private async announce(threadId: string): Promise<void> {
        const active = await this.executions.findLatestActiveByThread(threadId);
        if (active !== null) this.events.publish(active.id);
    }

    private async appendToolMessage(threadId: string, toolCallId: string, content: string, now: Date): Promise<string> {
        const message = ChatMessage.create({
            id: this.ids.next(),
            threadId,
            role: CHAT_MESSAGE_ROLE.tool,
            content,
            toolCallId,
            now,
        });
        await this.messages.append(message);
        return message.id;
    }
}
