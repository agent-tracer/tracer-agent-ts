import {
    EMPTY_RESULT_REASON,
    renderEmptyResultReason,
    type EmptyResultReason,
} from "~agent-worker/support/llm/empty.result.js";

export { renderEmptyResultReason };

/** 세 축이 같은 어휘를 쓰므로 사유의 정본은 계약을 읽는 support 쪽 한 자리가 갖는다. */
export const RECIPE_EMPTY_RESULT_REASON = EMPTY_RESULT_REASON;

export type RecipeEmptyResultReason = EmptyResultReason;

/** 사유를 구분하는 신호이며 이름은 계약의 적합성 케이스가 쓰는 입력 이름과 같다. */
export interface RecipeEmptyResultSignals {
    /** 계획 호출이 실패해 빈 계획으로 낮췄다. */
    readonly surveyCallFails?: boolean;
    /** 전문가가 예산을 소진한 채 질문을 닫지 못했다. */
    readonly probeExhausted?: boolean;
    /** 수리까지 쓰고도 검증을 통과하지 못했거나 산출을 전달하지 못했다. */
    readonly repairExhausted?: boolean;
}

/** 생성이 실패한 실행은 근거를 다 모았더라도 후보를 낼 수 없으므로 낮춘 실행을 근거 부족보다 앞에 둔다. */
export function recipeEmptyResultReason(signals: RecipeEmptyResultSignals): RecipeEmptyResultReason {
    if (signals.surveyCallFails === true || signals.repairExhausted === true) {
        return RECIPE_EMPTY_RESULT_REASON.generationDegraded;
    }
    if (signals.probeExhausted === true) return RECIPE_EMPTY_RESULT_REASON.insufficientEvidence;
    return RECIPE_EMPTY_RESULT_REASON.noPattern;
}
