import { CHAT_MESSAGE_ROLE } from "~agent-api/domain/chat/model/chat.const.js";

/** 요약이 있으면 이 수만큼의 최근 대화 턴만 재생 창에 남는다. */
export const CHAT_REPLAY_RECENT_KEEP_COUNT = 8;

/** 창 계산의 단위는 대화 턴이며, 도구 결과는 자기 턴에 딸려 함께 실린다. */
interface RoledMessage {
    readonly role: string;
}

/** 재생 창: 요약이 있으면 최근 대화 턴 여덟 개까지만 남기고 도구 결과는 세지 않는다. */
export function selectReplayMessages<T extends RoledMessage>(
    messages: readonly T[],
    hasSummary: boolean,
): readonly T[] {
    if (!hasSummary) return messages;
    let turns = 0;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index]!.role === CHAT_MESSAGE_ROLE.tool) continue;
        turns += 1;
        if (turns > CHAT_REPLAY_RECENT_KEEP_COUNT) return messages.slice(index + 1);
    }
    return messages;
}
