import type {
    ChatTurnMessage,
    ChatUserFact,
} from "~agent-worker/domain/chat/model/chat.turn.model.js";

/** 이 턴이 모델에게 되돌려 줄 이력이며 창 자르기와 도구 호출 짝 맞추기는 접수의 재생 규칙이 소유한다. */
export interface ChatReplayResponse {
    readonly messages: readonly ChatTurnMessage[];
    readonly summary: string | null;
    readonly facts: readonly ChatUserFact[];
}

/** 실행이 무엇이든 같은 재생 계산을 받도록 자기 원장으로 다시 구하지 않고 접수를 되읽는 포트다. */
export interface ChatReplayPort {
    fetchReplay(threadId: string, executionId: string): Promise<ChatReplayResponse>;
}

/** 실행 시도 하나에 매인 읽기 창구를 만드는 조립 함수이며 사용자 범위 자격이 생성 시점에 묶인다. */
export type ChatReplayClientFactory = (
    userId: string,
    scopeToken: string | undefined,
) => ChatReplayPort;
