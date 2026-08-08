import { landingReserveCalls } from "~llm/runner/landing.directive.js";

/** 마무리 호출 몫을 미리 떼어 두고 비용과 턴 어느 쪽이든 상한에 닿으면 종료할 때임을 알린다. */
export class LandingPacer {
    private turns = 0;
    private runningCostUsd = 0;
    private peakCallCostUsd = 0;
    private landed = false;
    private readonly reserve: number;

    constructor(
        private readonly maxTurns: number,
        private readonly maxBudgetUsd: number | undefined,
    ) {
        this.reserve = landingReserveCalls();
    }

    /** 모델 호출 하나를 세며 남은 턴이 마무리 몫에 닿으면 종료한다. */
    countTurn(): void {
        this.turns += 1;
        if (this.maxTurns > 0 && this.turns + this.reserve >= this.maxTurns) this.landed = true;
    }

    /** 호출 하나의 지출을 더하며 가장 비쌌던 호출의 몫을 남기고도 상한에 닿으면 종료한다. */
    spend(callCostUsd: number): void {
        this.runningCostUsd += callCostUsd;
        this.peakCallCostUsd = Math.max(this.peakCallCostUsd, callCostUsd);
        if (this.maxBudgetUsd === undefined) return;
        if (this.runningCostUsd + this.peakCallCostUsd * this.reserve >= this.maxBudgetUsd) {
            this.landed = true;
        }
    }

    get modelTurns(): number {
        return this.turns;
    }

    /** 한 번 종료로 정하면 되돌리지 않으므로 뒤늦게 싼 호출이 와도 도구를 다시 열지 않는다. */
    get isLanding(): boolean {
        return this.landed;
    }
}
