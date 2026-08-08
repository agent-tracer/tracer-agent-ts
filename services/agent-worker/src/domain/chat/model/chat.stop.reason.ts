import { AGENT_ERROR_SUBTYPE, isBudgetExhaustedSubtype } from "@tracer-agent/llm";
import { CHAT_STOP_REASON, type ChatStopReason } from "./chat.const.js";

const BY_SUBTYPE: Readonly<Record<string, ChatStopReason>> = {
    [AGENT_ERROR_SUBTYPE.deadlineExceeded]: CHAT_STOP_REASON.deadline,
    [AGENT_ERROR_SUBTYPE.maxTurnsExceeded]: CHAT_STOP_REASON.turnLimit,
    [AGENT_ERROR_SUBTYPE.budgetExceeded]: CHAT_STOP_REASON.budgetLanded,
    [AGENT_ERROR_SUBTYPE.cancelled]: CHAT_STOP_REASON.canceled,
};

export interface TurnStopSignals {
    readonly errorSubtype: string | null;
    readonly errorSummary: string | null;
    /** 예산이 다해 조사 도구를 거두고 결론만 받는 마지막 호출로 넘어갔는지다. */
    readonly landed: boolean;
}

/** 자유 텍스트를 내는 대화는 그때까지 쓴 답변이 곧 결론이라 종료로 적힌 중단을 실패로 접지 않는다. */
export function chatStopReason(signals: TurnStopSignals): ChatStopReason {
    if (signals.errorSubtype !== null) {
        const named = BY_SUBTYPE[signals.errorSubtype];
        if (named !== undefined) return named;
        return isBudgetExhaustedSubtype(signals.errorSubtype)
            ? CHAT_STOP_REASON.budgetLanded
            : CHAT_STOP_REASON.failed;
    }
    if (signals.errorSummary !== null) return CHAT_STOP_REASON.failed;
    if (signals.landed) return CHAT_STOP_REASON.budgetLanded;
    return CHAT_STOP_REASON.completed;
}
