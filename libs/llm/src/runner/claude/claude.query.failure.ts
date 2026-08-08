import { AGENT_ERROR_SUBTYPE, UnpricedModelError } from "~llm/model/agent.error.js";
import { DeadlineExceededError } from "~llm/model/deadline.js";
import { redactText } from "~llm/support/redaction.js";

/** 터진 실행을 원장에 적을 때 쓰는 사유 한 쌍이다. */
export interface QueryFailure {
    readonly errorSubtype: string;
    readonly errorSummary: string;
}

/** 던져진 값과 끊긴 신호의 모양에서 실행이 터진 까닭을 골라 이 실행기의 어휘로 적는다. */
export function classifyQueryFailure(error: unknown, signal: AbortSignal): QueryFailure {
    // 단가를 모르면 예산을 집행할 수 없어 스스로 끊은 것이므로 소진과 같은 자리에 둔다.
    if (error instanceof UnpricedModelError) {
        return { errorSubtype: AGENT_ERROR_SUBTYPE.budgetExceeded, errorSummary: error.message };
    }
    const reason: unknown = signal.reason;
    if (signal.aborted && reason instanceof DeadlineExceededError) {
        return { errorSubtype: AGENT_ERROR_SUBTYPE.deadlineExceeded, errorSummary: reason.message };
    }
    if (signal.aborted) {
        return {
            errorSubtype: AGENT_ERROR_SUBTYPE.cancelled,
            errorSummary: "query aborted (parent signal or external cancellation)",
        };
    }
    // 하위 프로세스가 낸 글에 자격 증명이 섞일 수 있으므로 적기 전에 가린다.
    return {
        errorSubtype: AGENT_ERROR_SUBTYPE.processError,
        errorSummary: redactText(error instanceof Error ? error.message : String(error)),
    };
}
