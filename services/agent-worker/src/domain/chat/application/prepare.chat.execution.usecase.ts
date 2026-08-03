import { logWarn, type IClock } from "@tracer-agent/platform";
import { CHAT_RUNNING_LEASE_MS } from "~agent-worker/domain/chat/model/chat.workflow.spec.js";
import {
    CHAT_EXECUTION_CLAIM,
    CHAT_EXECUTION_STATUS,
    CHAT_LANGUAGE,
} from "~agent-worker/domain/chat/model/chat.const.js";
import {
    ChatExecutionNotFoundError,
    ChatThreadBusyError,
} from "~agent-worker/domain/chat/model/chat.errors.js";
import type { PreparedChatExecution } from "~agent-worker/domain/chat/model/chat.execution.stage.js";
import type { ChatExecutionUpdatePublisherPort } from "~agent-worker/domain/chat/port/chat.execution.sink.port.js";
import type {
    ChatExecutionRepositoryPort,
    ChatThreadRepositoryPort,
} from "~agent-worker/domain/chat/port/chat.repository.port.js";

export class PrepareChatExecutionUsecase {
    constructor(
        private readonly executions: ChatExecutionRepositoryPort,
        private readonly threads: ChatThreadRepositoryPort,
        private readonly clock: IClock,
        private readonly events: ChatExecutionUpdatePublisherPort,
    ) {}

    async execute(executionId: string): Promise<PreparedChatExecution> {
        let execution = await this.executions.findById(executionId);
        if (execution === null) throw new ChatExecutionNotFoundError("Chat execution not found");
        if (execution.status === CHAT_EXECUTION_STATUS.queued) {
            await this.claim(executionId, execution.threadId);
            execution = await this.executions.findById(executionId);
        }
        if (execution === null || execution.status !== CHAT_EXECUTION_STATUS.running) {
            throw new Error("Chat execution is not active");
        }
        const thread = await this.threads.findById(execution.threadId);
        if (thread === null || !thread.isOwnedBy(execution.userId)) {
            throw new ChatExecutionNotFoundError("Thread not found");
        }
        this.events.publish(executionId);
        return {
            executionId,
            threadId: execution.threadId,
            userId: execution.userId,
            replayAnchorMessageId: execution.replayAnchorMessageId,
            language: execution.language ?? CHAT_LANGUAGE.auto,
            ...(execution.model !== null ? { model: execution.model } : {}),
        };
    }

    /** 스레드를 막은 running이 갱신을 멈춘 것이면 되돌리고 다시 가져가며 살아 있으면 물러난다. */
    private async claim(executionId: string, threadId: string): Promise<void> {
        if ((await this.executions.claimQueued(executionId, this.clock.now())) !== CHAT_EXECUTION_CLAIM.threadBusy) {
            return;
        }
        const now = this.clock.now();
        const recovered = await this.executions.recoverStaleRunning(
            new Date(now.getTime() - CHAT_RUNNING_LEASE_MS),
            now,
            threadId,
        );
        logWarn({ msg: "chat.thread_lock.contended", executionId, threadId, recovered });
        if (recovered === 0) throw new ChatThreadBusyError(threadId);
        if ((await this.executions.claimQueued(executionId, this.clock.now())) === CHAT_EXECUTION_CLAIM.threadBusy) {
            throw new ChatThreadBusyError(threadId);
        }
    }
}
