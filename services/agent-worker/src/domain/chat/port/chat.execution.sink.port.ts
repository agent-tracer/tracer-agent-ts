import type { ChatTurnSink } from "~agent-worker/domain/chat/model/chat.turn.model.js";

export interface ChatExecutionSinkHandle {
    readonly sink: ChatTurnSink;
    flush(): Promise<void>;
    close(): void;
}

export interface ChatExecutionSinkFactoryPort {
    create(executionId: string, attempt: number): ChatExecutionSinkHandle;
}

/** 저장된 실행 스냅샷이 갱신됐음을 스트림을 소유한 접수 replica에 알리는 유실 허용 신호다. */
export interface ChatExecutionUpdatePublisherPort {
    publish(executionId: string): void;
}

export interface ChatSchedulerPort {
    schedule(delayMs: number, callback: () => void): object;
    cancel(handle: object): void;
}
