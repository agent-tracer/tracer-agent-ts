import { featureModels } from "@tracer-agent/llm";
import { CHAT_MESSAGE_ROLE } from "./chat.const.js";

/** 압축 문턱과 재생 창 크기이며 도구 없는 단발 호출이라 요약 모델은 가장 싼 등급으로 충분하다. */
export const CHAT_SUMMARY_SPEC = {
    triggerMessageCount: 20,
    recentKeepCount: 8,
    triggerCharBudget: 12_000,
    limits: {
        model: featureModels("title-suggestion")!.default,
        maxOutputTokens: 600,
        deadlineMs: 30_000,
    },
} as const;

/** 메시지 수 또는 누적 글자 수 중 하나라도 문턱을 넘으면 압축한다. */
export function shouldSummarize(messages: readonly { readonly content: string }[]): boolean {
    if (messages.length > CHAT_SUMMARY_SPEC.triggerMessageCount) return true;
    const totalChars = messages.reduce((sum, message) => sum + message.content.length, 0);
    return totalChars > CHAT_SUMMARY_SPEC.triggerCharBudget;
}

/** 창 계산의 단위는 대화 턴이며 도구 결과는 자기 턴에 딸려 함께 실린다. */
interface RoledMessage {
    readonly role: string;
}

/** 요약이 있으면 최근 대화 턴만 남기고 도구 결과는 세지 않는다. */
export function selectReplayMessages<T extends RoledMessage>(
    messages: readonly T[],
    hasSummary: boolean,
): readonly T[] {
    if (!hasSummary) return messages;
    let turns = 0;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index]!.role === CHAT_MESSAGE_ROLE.tool) continue;
        turns += 1;
        if (turns > CHAT_SUMMARY_SPEC.recentKeepCount) return messages.slice(index + 1);
    }
    return messages;
}

/** 요약에 접어 넣을 오래된 메시지이며 재생 창 바깥에 남는 나머지다. */
export function selectMessagesToFold<T extends RoledMessage>(messages: readonly T[]): readonly T[] {
    const kept = selectReplayMessages(messages, true).length;
    return messages.slice(0, messages.length - kept);
}
