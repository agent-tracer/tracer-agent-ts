import { CHAT_MESSAGE_ROLE } from "~agent-api/domain/chat/model/chat.const.js";
import { readContractJson } from "~agent-api/support/contract.js";

interface DeclaredSummary {
    readonly consumption: { readonly recentKeepCount: number; readonly maxReplayMessages: number };
}

/** 요약이 있으면 이 수만큼의 최근 대화 턴만 재생 창에 남으며 그 수는 계약이 갖는다. */
const DECLARED = readContractJson<DeclaredSummary>("agent/chat/summary.json").consumption;

export const CHAT_REPLAY_RECENT_KEEP_COUNT = DECLARED.recentKeepCount;

/** 요약이 있든 없든 한 턴이 되돌려 주는 메시지의 절대 상한이며 요약이 실패해 쌓이는 스레드를 여기서 끊는다. */
export const CHAT_REPLAY_MAX_MESSAGES = DECLARED.maxReplayMessages;

/** 창 계산의 단위는 대화 턴이며, 도구 결과는 자기 턴에 딸려 함께 실린다. */
interface RoledMessage {
    readonly role: string;
}

/** 재생 창이며 요약이 있으면 계약이 정한 수만큼의 최근 대화 턴만 남기고 도구 결과는 세지 않는다. */
export function selectReplayMessages<T extends RoledMessage>(
    messages: readonly T[],
    hasSummary: boolean,
): readonly T[] {
    return capReplay(withinTurnWindow(messages, hasSummary));
}

/** 절대 상한을 넘긴 이력은 최근 것만 남기며 잘린 사실은 부르는 쪽이 길이로 안다. */
function capReplay<T>(messages: readonly T[]): readonly T[] {
    return messages.length > CHAT_REPLAY_MAX_MESSAGES
        ? messages.slice(messages.length - CHAT_REPLAY_MAX_MESSAGES)
        : messages;
}

function withinTurnWindow<T extends RoledMessage>(
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
