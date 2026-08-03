import { createHash } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CHAT_EXECUTION_STATUS, CHAT_MESSAGE_ROLE } from "~agent-api/domain/chat/model/chat.const.js";
import {
    ChatActiveTurnConflictError,
    ChatExecutionIdempotencyConflictError,
} from "~agent-api/domain/chat/model/chat.errors.js";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { ChatMessage } from "~agent-api/domain/chat/model/chat.message.model.js";
import {
    mapExecution,
    mapMessage,
    type ChatExecutionDto,
    type ChatMessageDto,
} from "~agent-api/domain/chat/model/chat.model.js";
import {
    CHAT_EXECUTION_DISPATCHER,
    type ChatExecutionDispatcherPort,
} from "~agent-api/domain/chat/port/chat.execution.dispatcher.port.js";
import { CHAT_ID_GENERATOR, type ChatIdGeneratorPort } from "~agent-api/domain/chat/port/chat.id.generator.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_MESSAGE_REPOSITORY,
    type ChatExecutionRepositoryPort,
    type ChatMessageRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";
import {
    CHAT_TRANSACTION,
    type ChatTransactionPort,
    type ChatTx,
} from "~agent-api/domain/chat/port/chat.transaction.port.js";
import { CHAT_CLOCK, type ClockPort } from "~agent-api/domain/chat/port/clock.port.js";

export interface EnqueueChatTurnInput {
    readonly userId: string;
    readonly threadId: string;
    readonly clientRequestId: string;
    readonly content: string;
    readonly model?: string;
    readonly language?: string;
}

interface AcceptedChatTurn {
    readonly message: ChatMessage;
    readonly execution: ChatExecution;
}

/** 대화 턴 하나를 접수해 사용자 메시지와 실행 행을 한 커밋으로 적고 워크플로를 알린다. */
@Injectable()
export class EnqueueChatTurnUseCase {
    constructor(
        @Inject(CHAT_TRANSACTION) private readonly transaction: ChatTransactionPort,
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY) private readonly messages: ChatMessageRepositoryPort,
        @Inject(CHAT_EXECUTION_DISPATCHER) private readonly dispatcher: ChatExecutionDispatcherPort,
        @Inject(CHAT_CLOCK) private readonly clock: ClockPort,
        @Inject(CHAT_ID_GENERATOR) private readonly ids: ChatIdGeneratorPort,
    ) {}

    async execute(input: EnqueueChatTurnInput): Promise<{
        readonly message: ChatMessageDto;
        readonly execution: ChatExecutionDto;
    }> {
        const inputHash = hashInput(input);
        let accepted: AcceptedChatTurn;
        try {
            accepted = await this.transaction.run((tx) => this.accept(tx, input, inputHash));
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
            accepted = await this.resolveExisting(input, inputHash);
        }

        if (accepted.execution.status === CHAT_EXECUTION_STATUS.queued) {
            await this.dispatcher.start(accepted.execution.id, accepted.execution.threadId);
        }
        return {
            message: mapMessage(accepted.message),
            execution: mapExecution(accepted.execution),
        };
    }

    private async accept(
        tx: ChatTx,
        input: EnqueueChatTurnInput,
        inputHash: string,
    ): Promise<AcceptedChatTurn> {
        const thread = await tx.chatThreads.findById(input.threadId);
        if (thread === null || !thread.isOwnedBy(input.userId)) {
            throw new NotFoundException("Thread not found");
        }

        const existing = await tx.chatExecutions.findByIdempotency(
            input.userId,
            input.threadId,
            input.clientRequestId,
        );
        if (existing !== null) return this.existing(tx.chatMessages, existing, inputHash);

        // 진행 중인 턴이 남아 있으면 두 실행이 같은 스레드를 나눠 나누어 순서가 역전된다.
        const active = await tx.chatExecutions.findLatestActiveByThread(input.threadId);
        if (active !== null) throw new ChatActiveTurnConflictError();

        const now = this.clock.now();
        const message = ChatMessage.create({
            id: this.ids.next(),
            threadId: input.threadId,
            role: CHAT_MESSAGE_ROLE.user,
            content: input.content,
            now,
        });
        const execution = ChatExecution.create({
            id: this.ids.next(),
            userId: input.userId,
            threadId: input.threadId,
            replayAnchorMessageId: message.id,
            clientRequestId: input.clientRequestId,
            inputHash,
            model: input.model ?? null,
            language: input.language ?? null,
            now,
        });
        await tx.chatMessages.append(message);
        await tx.chatExecutions.insert(execution);
        return { message, execution };
    }

    private async resolveExisting(
        input: EnqueueChatTurnInput,
        inputHash: string,
    ): Promise<AcceptedChatTurn> {
        const execution = await this.executions.findByIdempotency(
            input.userId,
            input.threadId,
            input.clientRequestId,
        );
        if (execution === null) throw new ChatExecutionIdempotencyConflictError();
        return this.existing(this.messages, execution, inputHash);
    }

    private async existing(
        messages: ChatMessageRepositoryPort,
        execution: ChatExecution,
        inputHash: string,
    ): Promise<AcceptedChatTurn> {
        if (execution.inputHash !== inputHash) throw new ChatExecutionIdempotencyConflictError();
        const message = await messages.findById(execution.replayAnchorMessageId);
        if (message === null) throw new Error("Chat execution user message is missing");
        return { message, execution };
    }
}

function hashInput(input: EnqueueChatTurnInput): string {
    return createHash("sha256")
        .update(JSON.stringify({
            content: input.content,
            model: input.model ?? null,
            language: input.language ?? null,
        }))
        .digest("hex");
}

function isUniqueViolation(error: unknown): boolean {
    if (errorCode(error) === "23505") return true;
    return errorCode((error as { readonly driverError?: unknown } | null)?.driverError) === "23505";
}

function errorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) return undefined;
    const code = (error as { readonly code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
}
