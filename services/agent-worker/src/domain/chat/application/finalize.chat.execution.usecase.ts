import { errorMessage, logError, logInfo, type IClock } from "@tracer-agent/platform";
import {
    CHAT_EXECUTION_STATUS,
    CHAT_MESSAGE_ROLE,
    CHAT_STOP_REASON,
} from "~agent-worker/domain/chat/model/chat.const.js";
import { ChatExecutionNotFoundError } from "~agent-worker/domain/chat/model/chat.errors.js";
import type { ChatExecutionSpend } from "~agent-worker/domain/chat/model/chat.execution.model.js";
import type { GeneratedChatExecution } from "~agent-worker/domain/chat/model/chat.execution.stage.js";
import { ChatMessage } from "~agent-worker/domain/chat/model/chat.message.model.js";
import type { ChatExecutionUpdatePublisherPort } from "~agent-worker/domain/chat/port/chat.execution.sink.port.js";
import type { ChatIdGeneratorPort } from "~agent-worker/domain/chat/port/chat.id.generator.port.js";
import type {
    ChatExecutionRepositoryPort,
    ChatMessageRepositoryPort,
    ChatThreadRepositoryPort,
} from "~agent-worker/domain/chat/port/chat.repository.port.js";
import type { ChatTransactionPort, ChatTx } from "~agent-worker/domain/chat/port/chat.transaction.port.js";
import type { GenerateThreadTitleProjection } from "./generate.thread.title.projection.js";
import type { SummarizeThreadProjection } from "./summarize.thread.projection.js";

export class FinalizeChatExecutionUsecase {
    constructor(
        private readonly executions: ChatExecutionRepositoryPort,
        private readonly threads: ChatThreadRepositoryPort,
        private readonly messages: ChatMessageRepositoryPort,
        private readonly transaction: ChatTransactionPort,
        private readonly clock: IClock,
        private readonly ids: ChatIdGeneratorPort,
        private readonly events: ChatExecutionUpdatePublisherPort,
        private readonly summaryProjection: SummarizeThreadProjection,
        private readonly titleProjection: GenerateThreadTitleProjection,
    ) {}

    async execute(generated: GeneratedChatExecution): Promise<void> {
        const execution = await this.executions.findById(generated.executionId);
        if (execution === null) throw new ChatExecutionNotFoundError("Chat execution not found");
        if (execution.status === CHAT_EXECUTION_STATUS.completed) return;
        const observation = generated.result.observation;
        if (observation.executionId !== execution.id || observation.attemptId !== String(generated.attempt)) {
            throw new Error("Chat observation identity does not match execution attempt");
        }
        const canceled =
            execution.status === CHAT_EXECUTION_STATUS.canceled || observation.status === "cancelled";
        if (!canceled && execution.status !== CHAT_EXECUTION_STATUS.running) {
            throw new Error("Chat execution is not running");
        }
        // 취소가 남긴 것이 빈 답변뿐이면 적재할 산출물이 없으므로 실행을 그대로 둔다.
        if (canceled && generated.result.text.trim().length === 0) return;
        const now = this.clock.now();
        const spend = spendOf(generated, canceled);
        const assistant = ChatMessage.create({
            id: execution.id,
            threadId: execution.threadId,
            role: CHAT_MESSAGE_ROLE.assistant,
            content: generated.result.text,
            toolCalls: generated.result.toolCalls,
            now,
        });
        const persisted = await this.transaction.run(async (tx: ChatTx) => {
            await tx.agentRunObservations.record(execution.userId, observation, now);
            const settled = canceled
                ? await tx.chatExecutions.recordCanceledOutcome(execution.id, assistant.id, spend, now)
                : await tx.chatExecutions.completeRunning(execution.id, assistant.id, spend, now);
            if (!settled) return false;
            await tx.chatMessages.append(assistant);
            await tx.chatExecutionSteps.insertMany(
                generated.result.steps.map((step) => ({
                    id: this.ids.next(),
                    executionId: execution.id,
                    userId: execution.userId,
                    attempt: generated.attempt,
                    step,
                    now,
                })),
            );
            const thread = await tx.chatThreads.findById(execution.threadId);
            if (thread === null || !thread.isOwnedBy(execution.userId)) {
                throw new ChatExecutionNotFoundError("Thread not found");
            }
            thread.recordTurn(generated.result.backend, now);
            await tx.chatThreads.update(thread);
            return true;
        });
        if (!persisted) return;
        this.events.publish(execution.id);
        if (canceled) {
            // 사용자가 지출을 멈추라고 한 턴이므로 요약과 제목을 새로 실행하지 않는다.
            logInfo({
                msg: "chat.turn.canceled",
                threadId: execution.threadId,
                userId: execution.userId,
                backend: generated.result.backend,
                model: generated.result.modelUsed,
                toolCalls: generated.result.toolCalls.length,
                costUsd: generated.result.costUsd,
                numTurns: generated.result.numTurns,
            });
            return;
        }
        logInfo({
            msg: "chat.turn.completed",
            threadId: execution.threadId,
            userId: execution.userId,
            backend: generated.result.backend,
            model: generated.result.modelUsed,
            toolCalls: generated.result.toolCalls.length,
            costUsd: generated.result.costUsd,
            numTurns: generated.result.numTurns,
            errorSummary: generated.result.errorSummary,
        });
        const [thread, history] = await Promise.all([
            this.threads.findById(execution.threadId),
            this.messages.listByThread(execution.threadId),
        ]);
        if (thread === null) return;
        // 사용자는 이미 답을 받았지만 파생 계산은 이 활동 안에서 끝내야 워커가 내려갈 때 사라지지 않는다.
        await Promise.all([
            this.project("summary", execution.threadId, () =>
                this.summaryProjection.project(thread, history),
            ),
            this.project("title", execution.threadId, () => this.titleProjection.project(thread, history)),
        ]);
    }

    /** 파생 계산이 실패해도 이미 적힌 턴을 실패로 되돌리지 않도록 이 자리에서 접는다. */
    private async project(name: string, threadId: string, run: () => Promise<void>): Promise<void> {
        try {
            await run();
        } catch (error) {
            logError({ msg: "chat.projection.failed", projection: name, threadId, error: errorMessage(error) });
        }
    }
}

/** 취소로 끝난 턴은 실행이 무엇을 보고했든 정지 사유를 취소로 남긴다. */
function spendOf(generated: GeneratedChatExecution, canceled: boolean): ChatExecutionSpend {
    const { modelUsed, costUsd, numTurns, stopReason, usage } = generated.result;
    return {
        modelUsed,
        costUsd,
        numTurns,
        stopReason: canceled ? CHAT_STOP_REASON.canceled : stopReason,
        usage: usage === null ? {} : { ...usage },
    };
}
