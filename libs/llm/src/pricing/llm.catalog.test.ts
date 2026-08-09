import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACT_ROOT } from "~llm/support/contract.js";
import {
    featureLimits,
    featureModels,
    isPricedModel,
    loadLlmCatalog,
    modelMaxOutputTokens,
    modelRate,
    wireModelRates,
} from "./llm.catalog.schema.js";

/** 계약이 프롬프트와 도구를 선언한 에이전트이며 shared 는 에이전트가 아니라 공통 선언이다. */
function contractAgents(): readonly string[] {
    return readdirSync(path.join(CONTRACT_ROOT, "agent"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== "shared")
        .map((entry) => entry.name);
}

describe("모델 카탈로그", () => {
    // 이 표는 계약 밖의 이름을 기능으로 들 수 있으므로 계약이 세운 에이전트의 수까지 함께 센다.
    it("계약이 세운 에이전트를 기능으로 갖고 그 밖의 기능을 갖지 않는다", () => {
        expect(Object.keys(loadLlmCatalog().features).sort()).toEqual([...contractAgents()].sort());
    });

    it("대화 기능의 기본 모델과 한도를 낸다", () => {
        expect(featureModels("chat")!.default).toBe("claude-sonnet-4-6");
        expect(featureLimits("chat").maxTurns).toBe(14);
    });

    it("모델별 출력 한도가 없으면 기능의 출력 한도로 떨어진다", () => {
        expect(modelMaxOutputTokens("recipe-scan", "claude-opus-5")).toBe(
            featureLimits("recipe-scan").maxOutputTokens,
        );
    });

    it("카탈로그가 선언하지 않은 기능을 거절한다", () => {
        expect(() => featureLimits("rule-generation")).toThrow("is not declared");
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
