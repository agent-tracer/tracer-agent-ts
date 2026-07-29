import type { ChatExecutionDispatcherPort } from "~agent-api/domain/chat/port/chat.execution.dispatcher.port.js";

/** 디스패처 포트의 대역이며 무엇을 기동하고 무엇을 중단했는지만 적어 둔다. */
export class RecordingChatExecutionDispatcher implements ChatExecutionDispatcherPort {
    readonly started: { readonly executionId: string; readonly threadId: string }[] = [];
    readonly canceled: string[] = [];

    start(executionId: string, threadId: string): Promise<void> {
        this.started.push({ executionId, threadId });
        return Promise.resolve();
    }

    cancel(executionId: string): Promise<void> {
        this.canceled.push(executionId);
        return Promise.resolve();
    }
}
