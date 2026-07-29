const STRUCTURED =
    "Cost budget reached. Stop calling tools and produce your final structured output now from what you already have.";

const FREE_TEXT =
    "Cost budget reached. Stop calling tools and write your final answer to the user now in plain prose, using only what you already have.";

/** 예산이 바닥난 실행에 남길 마무리 지시를 고르며 출력 스키마를 요구한 실행만 구조화 출력을 낸다. */
export function landingDirective(hasOutputSchema: boolean): string {
    return hasOutputSchema ? STRUCTURED : FREE_TEXT;
}
