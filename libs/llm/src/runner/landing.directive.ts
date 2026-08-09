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

/** 도구를 닫은 뒤 마무리 호출이 설 자리를 남기려고 계약이 정한 몫을 미리 뗀다. */
export function landingReserveCalls(): number {
    return loadExecutionBudgetContract().pacing.landingReserve.calls;
}

/** 공급자에게 넘기는 상한이며 실행을 조이는 자리보다 위에 두어 폭주만 끊게 한다. */
export function providerBudgetBackstop(maxBudgetUsd: number): number {
    return maxBudgetUsd * loadExecutionBudgetContract().pacing.landingReserve.providerBackstop;
}
