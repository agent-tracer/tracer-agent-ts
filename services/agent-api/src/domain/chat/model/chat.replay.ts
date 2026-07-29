import { CHAT_MESSAGE_ROLE } from "~agent-api/domain/chat/model/chat.const.js";
import type { ChatMessage, ChatToolCall } from "~agent-api/domain/chat/model/chat.message.model.js";
import { selectReplayMessages } from "~agent-api/domain/chat/model/chat.replay.spec.js";
import { toChatTurnMessage, type ChatTurnMessage } from "~agent-api/domain/chat/model/chat.turn.model.js";

/** 이번 턴이 모델에게 되돌려 줄 이력을 만드는 유일한 규칙이며, 창 자르기와 도구 호출 짝 맞추기를 함께 소유한다. */
export function buildChatReplay(
    messages: readonly ChatMessage[],
    userMessageId: string,
    summary: string | null,
): readonly ChatTurnMessage[] {
    const window = selectReplayMessages(
        untilUserMessage(messages, userMessageId),
        summary !== null && summary.trim().length > 0,
    );
    const paired = pairedCallIds(window);
    return window.flatMap((message) => replayMessage(message, paired));
}

/** 이번 턴의 사용자 메시지까지가 이력이며, 그 뒤 행은 이 턴이 만들 것이라 아직 이력이 아니다. */
function untilUserMessage(
    messages: readonly ChatMessage[],
    userMessageId: string,
): readonly ChatMessage[] {
    const index = messages.findIndex((message) => message.id === userMessageId);
    if (index < 0) throw new Error("Chat replay message not found");
    return messages.slice(0, index + 1);
}

// 확인 게이트 때문에 결과 없는 도구 호출이 정상적으로 쌓이고, 거절당한 호출은 영영 짝이 없다.
function pairedCallIds(window: readonly ChatMessage[]): ReadonlySet<string> {
    const paired = new Set<string>();
    for (const [index, message] of window.entries()) {
        const declared = declaredCallIds(message);
        if (declared === null) continue;
        if (answeredCallIds(window, index, declared).size === declared.size) {
            for (const id of declared) paired.add(id);
        }
    }
    return paired;
}

function declaredCallIds(message: ChatMessage): ReadonlySet<string> | null {
    if (message.role !== CHAT_MESSAGE_ROLE.assistant) return null;
    const calls = message.toolCalls ?? [];
    return calls.length > 0 ? new Set(calls.map((call) => call.id)) : null;
}

/** 결과는 호출 바로 뒤에 이어져야 하며, 다른 역할이 끼어드는 순간 그 호출은 답을 못 받은 것이다. */
function answeredCallIds(
    window: readonly ChatMessage[],
    callIndex: number,
    declared: ReadonlySet<string>,
): ReadonlySet<string> {
    const answered = new Set<string>();
    for (const follower of window.slice(callIndex + 1)) {
        if (follower.role !== CHAT_MESSAGE_ROLE.tool) break;
        if (follower.toolCallId !== null && declared.has(follower.toolCallId)) answered.add(follower.toolCallId);
    }
    return answered;
}

function replayMessage(message: ChatMessage, paired: ReadonlySet<string>): readonly ChatTurnMessage[] {
    const turn = toChatTurnMessage(message);
    if (message.role === CHAT_MESSAGE_ROLE.tool) {
        const answers = message.toolCallId !== null && paired.has(message.toolCallId);
        // 짝을 잃은 결과도 승인된 행위의 산물이라 버리지 않고, 인용만 지워 평문 문맥으로 남긴다.
        return [answers ? turn : { role: turn.role, content: turn.content }];
    }
    if (message.role !== CHAT_MESSAGE_ROLE.assistant) return [turn];
    const calls = keptCalls(message, paired);
    if (calls.length > 0) return [{ ...turn, toolCalls: calls }];
    // 부르지 않은 것이나 다름없는 호출만 남은 빈 메시지는 재생할 것이 없다.
    return turn.content.length > 0 ? [{ role: turn.role, content: turn.content }] : [];
}

function keptCalls(message: ChatMessage, paired: ReadonlySet<string>): readonly ChatToolCall[] {
    return (message.toolCalls ?? []).filter((call) => paired.has(call.id));
}
