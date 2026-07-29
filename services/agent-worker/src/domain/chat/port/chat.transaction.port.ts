import type {
    AgentRunObservationRepositoryPort,
    ChatExecutionRepositoryPort,
    ChatExecutionStepRepositoryPort,
    ChatMessageRepositoryPort,
    ChatThreadRepositoryPort,
} from "./chat.repository.port.js";

export interface ChatTx {
    readonly agentRunObservations: AgentRunObservationRepositoryPort;
    readonly chatExecutions: ChatExecutionRepositoryPort;
    readonly chatExecutionSteps: ChatExecutionStepRepositoryPort;
    readonly chatMessages: ChatMessageRepositoryPort;
    readonly chatThreads: ChatThreadRepositoryPort;
}

export interface ChatTransactionPort {
    run<T>(work: (tx: ChatTx) => Promise<T>): Promise<T>;
}
