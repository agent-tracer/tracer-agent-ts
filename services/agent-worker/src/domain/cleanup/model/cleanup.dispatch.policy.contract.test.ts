import { describe, expect, it } from "vitest";
import { readContractJson } from "~agent-worker/support/contract.js";
import {
    MIN_DECISION_TURNS,
    REPAIR_RESERVED_BUDGET_SHARE,
    REPAIR_RESERVED_TURNS,
    TRIAGE_BUDGET_SHARE,
    TRIAGE_TURNS,
} from "./cleanup.dispatch.policy.js";

interface ReservationEntry {
    readonly turns: number;
    readonly budgetShare: number;
}

const { reservation } = readContractJson<{
    readonly reservation: {
        readonly repair: ReservationEntry;
        readonly survey: ReservationEntry;
        readonly synthesisFloor: ReservationEntry;
    };
}>("agent/shared/execution.budget.json");

describe("정리 실행이 떼어 두는 예약", () => {
    it("수리 몫을 계약이 적은 값으로 뗀다", () => {
        expect(REPAIR_RESERVED_TURNS).toBe(reservation.repair.turns);
        expect(REPAIR_RESERVED_BUDGET_SHARE).toBe(reservation.repair.budgetShare);
    });

    it("선별 몫은 계약이 계획 단계에 적은 survey 몫과 같다", () => {
        expect(TRIAGE_TURNS).toBe(reservation.survey.turns);
        expect(TRIAGE_BUDGET_SHARE).toBe(reservation.survey.budgetShare);
    });

    it("결정 바닥 턴을 계약이 적은 종합 바닥으로 뗀다", () => {
        expect(MIN_DECISION_TURNS).toBe(reservation.synthesisFloor.turns);
    });
});
