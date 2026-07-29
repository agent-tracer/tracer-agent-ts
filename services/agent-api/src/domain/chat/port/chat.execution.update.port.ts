export const CHAT_EXECUTION_UPDATE_PUBLISHER = Symbol("ChatExecutionUpdatePublisher");
export const CHAT_EXECUTION_UPDATE_SUBSCRIBER = Symbol("ChatExecutionUpdateSubscriber");

/** 저장된 실행 스냅샷이 갱신됐음을 replica에 알리는 유실 허용 신호다. */
export interface ChatExecutionUpdatePublisherPort {
    publish(executionId: string): void;
}

/** SSE 연결을 소유한 replica가 특정 실행의 새 스냅샷을 다시 읽게 한다. */
export interface ChatExecutionUpdateSubscriberPort {
    subscribe(executionId: string, listener: () => void): () => void;
}
