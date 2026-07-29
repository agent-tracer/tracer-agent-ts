import type {
    ChatTurnInput,
    ChatTurnResult,
    ChatTurnSink,
} from "~agent-worker/domain/chat/model/chat.turn.model.js";

/** 대화 턴 하나를 언어 모델로 실행하는 포트다. */
export interface ChatAgentPort {
    requiresLocalApiKey(): boolean;
    converse(input: ChatTurnInput, sink: ChatTurnSink): Promise<ChatTurnResult>;
}
