import { describe, expect, it } from "vitest";
import {
    MIN_SYNTHESIS_TURNS,
    REPAIR_RESERVED_BUDGET_SHARE,
    REPAIR_RESERVED_TURNS,
    SURVEY_BUDGET_SHARE,
    SURVEY_TURNS,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.policy.js";
import { readAgentCases } from "~agent-worker/support/contract.js";
import { ExecutionBudget } from "./agent.budget.js";

interface WeightAllocationCase {
    readonly name: string;
    readonly requestedTurns: readonly number[];
    readonly availableTurns: number;
    readonly availableUsd: number;
    readonly expect: { readonly grantedTurns: readonly number[]; readonly grantedUsd: readonly number[] };
}

interface ReservationCase {
    readonly startingRemainingTurns: number;
    readonly startingRemainingBudgetUsd: number;
    readonly expect: {
        readonly repair: { readonly grantedTurns: number; readonly grantedUsd: number };
        readonly survey: { readonly grantedTurns: number; readonly grantedUsd: number };
        readonly synthesisFloor: { readonly grantedTurns: number; readonly grantedUsd: number };
        readonly remainingAfterAll: { readonly turns: number; readonly budgetUsd: number };
    };
}

interface RecipeScanExecutionBudgetCases {
    readonly weightAllocation: { readonly cases: readonly WeightAllocationCase[] };
    readonly reservation: ReservationCase;
}

interface RecipeScanCases {
    readonly executionBudget: RecipeScanExecutionBudgetCases;
}

const { executionBudget } = readAgentCases<RecipeScanCases>("recipe-scan");

describe("실행 예산 배분", () => {
    it.each(executionBudget.weightAllocation.cases)(
        "quoteShares가 계약이 적은 턴과 달러 배열을 낸다 — $name",
        (testCase) => {
            const budget = new ExecutionBudget({
                maxBudgetUsd: testCase.availableUsd,
                maxTurns: testCase.availableTurns,
            });
            const leases = budget.quoteShares(testCase.requestedTurns, 1);
            expect(leases.map((lease) => lease.maxTurns)).toEqual([...testCase.expect.grantedTurns]);
            leases.forEach((lease, index) => {
                expect(lease.maxBudgetUsd).toBeCloseTo(testCase.expect.grantedUsd[index]!, 10);
            });
        },
    );

    it("repair → survey → synthesisFloor 순서로 뜬 예약이 계약이 적은 값과 같다", () => {
        const { reservation } = executionBudget;
        const budget = new ExecutionBudget({
            maxBudgetUsd: reservation.startingRemainingBudgetUsd,
            maxTurns: reservation.startingRemainingTurns,
        });

        const repairLease = budget.reserve(REPAIR_RESERVED_TURNS, REPAIR_RESERVED_BUDGET_SHARE);
        const surveyLease = budget.reserve(SURVEY_TURNS, SURVEY_BUDGET_SHARE);
        const synthesisFloorLease = budget.reserve(MIN_SYNTHESIS_TURNS, 0);

        expect(repairLease.maxTurns).toBe(reservation.expect.repair.grantedTurns);
        expect(repairLease.maxBudgetUsd).toBeCloseTo(reservation.expect.repair.grantedUsd, 10);
        expect(surveyLease.maxTurns).toBe(reservation.expect.survey.grantedTurns);
        expect(surveyLease.maxBudgetUsd).toBeCloseTo(reservation.expect.survey.grantedUsd, 10);
        expect(synthesisFloorLease.maxTurns).toBe(reservation.expect.synthesisFloor.grantedTurns);
        expect(synthesisFloorLease.maxBudgetUsd).toBeCloseTo(reservation.expect.synthesisFloor.grantedUsd, 10);

        const remaining = budget.quoteShare(1);
        expect(remaining.maxTurns).toBe(reservation.expect.remainingAfterAll.turns);
        expect(remaining.maxBudgetUsd).toBeCloseTo(reservation.expect.remainingAfterAll.budgetUsd, 10);
    });
});
