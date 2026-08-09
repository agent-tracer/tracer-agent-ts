import { describe, expect, it } from "vitest";
import { cacheWriteTtl, loadLlmCatalog } from "@tracer-agent/llm";
import { readContractJson } from "~agent-worker/support/contract.js";

interface DeclaredRates {
    readonly base: Readonly<Record<string, { readonly input: number; readonly output: number }>>;
    readonly cache: {
        readonly writeMultiplier: Readonly<Record<string, number>>;
        readonly readMultiplier: number;
        readonly defaultTtl: string;
    };
}

const DECLARED = readContractJson<DeclaredRates>("agent/shared/model.rates.json");
const MODELS = Object.entries(loadLlmCatalog().models).map(([id, rate]) => ({ id, rate }));

/** 백만 토큰당 달러는 소수라 곱한 값이 표기와 어긋날 수 있으므로 센트의 백만분의 일까지만 비교한다. */
function near(value: number): number {
    return Math.round(value * 1e6);
}

describe("계약이 소유한 모델 단가", () => {
    it("계약이 적은 모델과 이 축의 단가표가 같은 모델을 갖는다", () => {
        expect(MODELS.map(({ id }) => id).sort()).toEqual(Object.keys(DECLARED.base).sort());
    });

    it.each(MODELS)("$id 의 입력과 출력 단가가 계약이 적은 값과 같다", ({ id, rate }) => {
        expect({ input: rate.input, output: rate.output }).toEqual(DECLARED.base[id]);
    });

    // 수명을 바꾸면 배수가 바뀌므로 표의 캐시 단가도 함께 바뀌어야 한다.
    it("이 축이 요청하는 캐시 수명을 계약이 배수와 함께 갖는다", () => {
        expect(DECLARED.cache.writeMultiplier[cacheWriteTtl()]).toBeGreaterThan(0);
    });

    it("실행기가 수명을 지정하지 않으므로 요청하는 수명이 계약이 적은 기본값이다", () => {
        expect(cacheWriteTtl()).toBe(DECLARED.cache.defaultTtl);
    });

    it.each(MODELS)("$id 의 캐시 쓰기 단가가 입력 단가에 그 수명의 배수를 곱한 값이다", ({ rate }) => {
        const multiplier = DECLARED.cache.writeMultiplier[cacheWriteTtl()] ?? 0;

        expect(near(rate.cacheWrite)).toBe(near(rate.input * multiplier));
    });

    it.each(MODELS)("$id 의 캐시 읽기 단가가 입력 단가에 계약이 적은 배수를 곱한 값이다", ({ rate }) => {
        expect(near(rate.cacheRead)).toBe(near(rate.input * DECLARED.cache.readMultiplier));
    });
});
