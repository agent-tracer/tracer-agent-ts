import type { ChatMessageRole } from "~agent-api/domain/chat/model/chat.const.js";
import type { ChatMessage, ChatToolCall } from "~agent-api/domain/chat/model/chat.message.model.js";

/** 대화 턴에 재생되는 이전 메시지 한 건이며, 저장 모델이 아닌 재생용 평문이다. */
export interface ChatTurnMessage {
    readonly role: ChatMessageRole;
    readonly content: string;
    readonly toolCalls?: readonly ChatToolCall[];
    readonly toolCallId?: string;
}

/** 사용자에 대해 모델이 오래 기억하는 사실 한 건이며, key가 재작성 대상을 찾는 안정된 슬러그다. */
export interface ChatUserFact {
    readonly key: string;
    readonly content: string;
}

/** 저장 모델을 재생용 평문으로 벗겨 내며 이 축의 재생 계산이 이 변환만 쓴다. */
export function toChatTurnMessage(message: ChatMessage): ChatTurnMessage {
    return {
        role: message.role,
        content: message.content,
        ...(message.toolCalls !== null ? { toolCalls: message.toolCalls } : {}),
        ...(message.toolCallId !== null ? { toolCallId: message.toolCallId } : {}),
    };
}
