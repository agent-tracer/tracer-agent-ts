import { readContractJson } from "~agent-api/support/contract.js";

interface DeclaredSummary {
    readonly consumption: { readonly maxReplayMessages: number };
}

/** 요약이 있든 없든 한 턴이 되돌려 주는 메시지의 절대 상한이며 요약이 실패해 쌓이는 스레드를 여기서 끊는다. */
export const CHAT_REPLAY_MAX_MESSAGES =
    readContractJson<DeclaredSummary>("agent/chat/summary.json").consumption.maxReplayMessages;

/** 재생 창을 자를 때 보는 칸이며 접은 지점 뒤부터가 이 턴이 되돌려 줄 이력이다. */
interface IdentifiedMessage {
    readonly id: string;
}

/** 재생 창이며 요약이 접은 지점 뒤부터 싣고 지점이 없으면 이력을 그대로 싣는다. */
export function selectReplayMessages<T extends IdentifiedMessage>(
    messages: readonly T[],
    summaryThroughMessageId: string | null,
): readonly T[] {
    return capReplay(afterFoldPoint(messages, summaryThroughMessageId));
}

/** 접은 지점을 못 찾으면 그 요약이 이 이력을 덮지 않는다는 뜻이므로 자르지 않는다. */
function afterFoldPoint<T extends IdentifiedMessage>(
    messages: readonly T[],
    throughMessageId: string | null,
): readonly T[] {
    if (throughMessageId === null) return messages;
    const index = messages.findIndex((message) => message.id === throughMessageId);
    return index < 0 ? messages : messages.slice(index + 1);
}

/** 절대 상한을 넘긴 이력은 최근 것만 남기며 잘린 사실은 부르는 쪽이 길이로 안다. */
function capReplay<T>(messages: readonly T[]): readonly T[] {
    return messages.length > CHAT_REPLAY_MAX_MESSAGES
        ? messages.slice(messages.length - CHAT_REPLAY_MAX_MESSAGES)
        : messages;
}

