export const CHAT_EXECUTION_DISPATCHER = Symbol("ChatExecutionDispatcher");

export interface ChatExecutionDispatcherPort {
    start(executionId: string, threadId: string): Promise<void>;
    cancel(executionId: string): Promise<void>;
}
