/**
 * 빈 결과로 끝난 실행이 왜 비었는지를 적는 어휘이며 값은 계약의
 * `agent/shared/execution.budget.json`의 `orchestratorFailureDemotion.emptyResultReason`이 소유한다.
 */
export const RECIPE_EMPTY_RESULT_REASON = {
    /** 조사 계획이 비었거나 후보가 만들어지지 않았고 실행 자체는 정상이었다. */
    noPattern: "no-pattern",
    /** 조사를 실행했으나 근거가 모자라 후보를 세울 수 없었다. */
    insufficientEvidence: "insufficient-evidence",
    /** 계획·조사·검증·전달 가운데 한 단계가 실패해 산출을 빈 결과로 낮췄다. */
    generationDegraded: "generation-degraded",
} as const;

export type RecipeEmptyResultReason =
    (typeof RECIPE_EMPTY_RESULT_REASON)[keyof typeof RECIPE_EMPTY_RESULT_REASON];

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

/** 궤적 한 줄에 담기는 글자이며 두 축이 같은 글자를 내야 원장에서 사유가 대조된다. */
export function renderEmptyResultReason(reason: RecipeEmptyResultReason): string {
    return `empty result: ${reason}`;
}
