import { loadExecutionBudgetContract } from "~llm/model/execution.budget.schema.js";

/** 예산이 소진된 실행에 남길 마무리 지시를 고르며 출력 스키마를 요구한 실행만 구조화 출력을 낸다. */
export function landingDirective(hasOutputSchema: boolean): string {
    const { landingDirective: directive } = loadExecutionBudgetContract().pacing;
    return hasOutputSchema ? directive.structured : directive.freeText;
}

/** 모델이 남은 몫을 보고 답의 밀도를 정하도록 쓴 턴과 총량을 계약의 문구에 채운다. */
export function progressNotice(used: number, total: number): string {
    const { template } = loadExecutionBudgetContract().pacing.progressNotice;
    return template.replace("{used}", String(used)).replace("{total}", String(total));
}
