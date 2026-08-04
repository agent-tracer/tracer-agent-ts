import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { logInfo, logWarn } from "@tracer-agent/platform";
import {
    CHAT_EXECUTION_ENQUEUE_SIGNAL,
    CHAT_EXECUTION_TASK_QUEUE,
    CHAT_RUNNING_LEASE_MS,
    CHAT_THREAD_WORKFLOW,
} from "~agent-api/config/chat.queue.const.js";
import { createTemporalConnection, isWorkflowNotFound, type TemporalHandle } from "~agent-api/config/temporal.factory.js";
import type { ChatExecutionDispatcherPort } from "~agent-api/domain/chat/port/chat.execution.dispatcher.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    type ChatExecutionRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";

/** 실행 식별자를 워크플로 식별자로 삼아 접수 재시도와 replica 경쟁을 하나의 실행으로 합친다. */
@Injectable()
export class ChatWorkflowDispatcher implements ChatExecutionDispatcherPort, OnModuleInit, OnModuleDestroy {
    private handle: Promise<TemporalHandle> | null = null;

    constructor(
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
    ) {}

    async onModuleInit(): Promise<void> {
        // 주인이 사라진 running은 유니크 인덱스로 그 스레드의 다음 턴을 막으므로 기동할 때 한 번 조회한다.
        const now = new Date();
        const recovered = await this.executions.recoverStaleRunning(
            new Date(now.getTime() - CHAT_RUNNING_LEASE_MS),
            now,
        );
        if (recovered > 0) logInfo({ msg: "chat.workflow.recovered", count: recovered });
        for (const execution of await this.executions.listActive()) {
            await this.start(execution.id, execution.threadId);
        }
    }

    async start(executionId: string, threadId: string): Promise<void> {
        const { client } = await this.connection();
        await client.workflow.signalWithStart(CHAT_THREAD_WORKFLOW, {
            taskQueue: CHAT_EXECUTION_TASK_QUEUE,
            workflowId: threadWorkflowId(threadId),
            workflowIdConflictPolicy: "USE_EXISTING",
            workflowIdReusePolicy: "ALLOW_DUPLICATE",
            args: [{ threadId }],
            signal: CHAT_EXECUTION_ENQUEUE_SIGNAL,
            signalArgs: [executionId],
            memo: { threadId },
        });
        logInfo({ msg: "chat.workflow.started", executionId, threadId });
    }

    async cancel(executionId: string): Promise<void> {
        const { client } = await this.connection();
        try {
            await client.workflow.getHandle(workflowId(executionId)).cancel();
        } catch (error) {
            if (!isWorkflowNotFound(error)) throw error;
            logWarn({ msg: "chat.workflow_cancel.absent", executionId });
        }
    }

    async onModuleDestroy(): Promise<void> {
        if (this.handle === null) return;
        const handle = await this.handle.catch(() => null);
        if (handle !== null) await handle.connection.close().catch(() => undefined);
    }

    private connection(): Promise<TemporalHandle> {
        if (this.handle === null) {
            this.handle = createTemporalConnection().catch((error: unknown) => {
                this.handle = null;
                throw error;
            });
        }
        return this.handle;
    }
}

function workflowId(executionId: string): string {
    return `chat:${executionId}`;
}

function threadWorkflowId(threadId: string): string {
    return `chat-thread:${threadId}`;
}
