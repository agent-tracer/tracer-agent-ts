import { featureModels } from "@tracer-agent/llm";
import { readContractJson } from "~agent-worker/support/contract.js";
import { CHAT_MESSAGE_ROLE } from "./chat.const.js";

interface ChatSummaryContract {
    readonly production: {
        readonly trigger: { readonly messages: number; readonly chars: number };
        readonly recentKeepCount: number;
    };

    readonly limits: { readonly maxOutputTokens: number; readonly deadlineMs: number };
}

const DECLARED = readContractJson<ChatSummaryContract>("agent/chat/summary.json");

/** 압축 문턱과 재생 창 크기는 계약이 갖고 도구 없는 단발 호출이라 요약 모델은 가장 싼 등급으로 충분하다. */
export const CHAT_SUMMARY_SPEC = {
    triggerMessageCount: DECLARED.production.trigger.messages,
    recentKeepCount: DECLARED.production.recentKeepCount,
    triggerCharBudget: DECLARED.production.trigger.chars,
    limits: {
        model: featureModels("title-suggestion")!.default,
        maxOutputTokens: DECLARED.limits.maxOutputTokens,
        deadlineMs: DECLARED.limits.deadlineMs,
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

/** 접지 않고 남길 최근 대화 턴이며 도구 결과는 턴으로 세지 않는다. */
export function selectMessagesToKeep<T extends RoledMessage>(
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
    const kept = selectMessagesToKeep(messages, true).length;
    return messages.slice(0, messages.length - kept);
}
