import { describe, expect, it } from "vitest";
import { readContractYaml } from "~agent-worker/support/contract.js";
import {
    recordModelLanded,
    recordProbeExhaustion,
    recordRedispatchRounds,
    recordValidationFailure,
} from "./execution.metrics.js";

interface DeclaredInstrument {
    readonly name: string;
    readonly kind: string;
    readonly unit: string;
    readonly labels: readonly string[];
}

const DECLARED = readContractYaml<{
    readonly executionMetrics: { readonly instruments: readonly DeclaredInstrument[] };
}>("workflow/metrics.yaml").executionMetrics.instruments;

describe("비용 축 지표", () => {
    it("계약이 적은 지표 넷을 모두 세운다", () => {
        expect(DECLARED.map((one) => one.name).sort()).toEqual([
            "agent.model.landed",
            "agent.probe.budget.exhaustion_ratio",
            "agent.redispatch.rounds",
            "agent.validation.failure",
        ]);
    });

    it("몫을 모르는 전문가는 소진 비율을 내지 않는다", () => {
        expect(() => recordProbeExhaustion("recipe-scan", "timeline", 0.1, undefined)).not.toThrow();
        expect(() => recordProbeExhaustion("recipe-scan", "timeline", null, 0.2)).not.toThrow();
        expect(() => recordProbeExhaustion("recipe-scan", "timeline", 0.1, 0)).not.toThrow();
    });

    it("몫보다 더 쓴 실행도 비율이 1을 넘지 않는다", () => {
        expect(() => recordProbeExhaustion("recipe-scan", "timeline", 0.5, 0.2)).not.toThrow();
    });

    it("나머지 셋도 계약의 라벨로 기록한다", () => {
        expect(() => recordRedispatchRounds("recipe-scan", 1)).not.toThrow();
        expect(() => recordValidationFailure("recipe-scan", true)).not.toThrow();
        expect(() => recordModelLanded("recipe-scan")).not.toThrow();
    });
});
