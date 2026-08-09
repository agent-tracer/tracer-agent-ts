import { describe, expect, it } from "vitest";
import {
    featureLimits,
    featureModels,
    isPricedModel,
    modelMaxOutputTokens,
    modelRate,
    wireModelRates,
} from "./llm.catalog.schema.js";

describe("모델 카탈로그", () => {
    it("대화 기능의 기본 모델과 한도를 낸다", () => {
        expect(featureModels("chat")!.default).toBe("claude-sonnet-4-6");
        expect(featureLimits("chat").maxTurns).toBe(14);
    });

    it("모델별 출력 한도가 없으면 기능의 출력 한도로 떨어진다", () => {
        expect(modelMaxOutputTokens("recipe-scan", "claude-opus-5")).toBe(
            featureLimits("recipe-scan").maxOutputTokens,
        );
    });

    it("한도를 적지 않은 기능을 거절한다", () => {
        expect(() => featureLimits("rule-generation")).toThrow("has no limits");
    });

    it("날짜가 붙은 구체 이름을 별칭의 단가로 읽는다", () => {
        expect(modelRate("claude-sonnet-4-6-20260101")?.input).toBe(3.0);
    });

    it("단가를 모르는 모델을 가른다", () => {
        expect(isPricedModel("claude-sonnet-4-6")).toBe(true);
        expect(isPricedModel("gpt-4")).toBe(false);
    });

    it("봉투에 실을 단가에서 사람이 읽는 이름을 뺀다", () => {
        expect(wireModelRates()["claude-opus-5"]).toEqual({
            input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5,
        });
    });
});
