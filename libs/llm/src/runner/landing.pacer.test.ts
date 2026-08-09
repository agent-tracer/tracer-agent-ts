import { describe, expect, it } from "vitest";
import { landingReserveCalls } from "./landing.directive.js";
import { hardTurnCeiling, LandingPacer } from "./landing.pacer.js";

const RESERVE = landingReserveCalls();

describe("마무리 몫을 남기는 착지 판정", () => {
    it("턴이 넉넉한 동안에는 착지하지 않는다", () => {
        const pacer = new LandingPacer(RESERVE + 5, undefined);

        pacer.countTurn();

        expect(pacer.isLanding).toBe(false);
    });

    it("모델에게 알린 턴을 다 쓰면 착지한다", () => {
        const pacer = new LandingPacer(1, undefined);

        pacer.countTurn();

        expect(pacer.isLanding).toBe(true);
    });

    it("마무리 몫은 착지 시점을 앞당기지 않는다", () => {
        const pacer = new LandingPacer(RESERVE + 1, undefined);

        for (let turn = 0; turn < RESERVE; turn += 1) pacer.countTurn();

        expect(pacer.isLanding).toBe(false);
    });

    it("턴 상한이 없는 실행은 턴으로 착지하지 않는다", () => {
        const pacer = new LandingPacer(0, undefined);

        for (let turn = 0; turn < 50; turn += 1) pacer.countTurn();

        expect(pacer.isLanding).toBe(false);
    });

    it("예산을 걸지 않으면 아무리 써도 비용으로 착지하지 않는다", () => {
        const pacer = new LandingPacer(100, undefined);

        pacer.spend(1000);

        expect(pacer.isLanding).toBe(false);
    });

    it("가장 비쌌던 호출의 몫을 남기고도 상한에 닿으면 착지한다", () => {
        // 한 호출에 1 을 쓰면 마무리 몫까지 더한 값이 상한과 같아진다.
        const pacer = new LandingPacer(100, 1 + RESERVE);

        pacer.spend(1);

        expect(pacer.isLanding).toBe(true);
    });

    it("마무리 몫을 남기고도 여유가 있으면 아직 착지하지 않는다", () => {
        const pacer = new LandingPacer(100, 1 + RESERVE + 0.5);

        pacer.spend(1);

        expect(pacer.isLanding).toBe(false);
    });

    it("한 번 착지하면 그 뒤의 싼 호출이 착지를 되돌리지 않는다", () => {
        const pacer = new LandingPacer(100, 1 + RESERVE);
        pacer.spend(1);

        pacer.spend(0);

        expect(pacer.isLanding).toBe(true);
    });

    it("쓴 턴 수를 그대로 알려 진행 안내가 같은 수를 쓴다", () => {
        const pacer = new LandingPacer(100, undefined);

        pacer.countTurn();
        pacer.countTurn();

        expect(pacer.modelTurns).toBe(2);
    });
});

describe("모델에게 알린 턴과 하드 상한", () => {
    it("하드 상한은 마무리 호출 몫만큼 위에 둔다", () => {
        expect(hardTurnCeiling(10)).toBe(10 + RESERVE);
    });

    it("턴 상한이 없는 실행에는 몫을 더하지 않는다", () => {
        expect(hardTurnCeiling(0)).toBe(0);
    });

    it("알린 턴을 다 쓴 뒤에도 마무리 호출이 설 자리가 남는다", () => {
        const declared = 4;
        const pacer = new LandingPacer(declared, undefined);

        for (let turn = 0; turn < declared; turn += 1) pacer.countTurn();

        expect(pacer.isLanding).toBe(true);
        expect(hardTurnCeiling(declared) - pacer.modelTurns).toBe(RESERVE);
    });
});
