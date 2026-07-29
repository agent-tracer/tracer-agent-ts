import { describe, expect, it } from "vitest";
import { featureLimits, featureModels, loadLlmCatalog } from "./llm.catalog.schema.js";
import { canEstimateCost, estimateCostUsd } from "./pricing.js";

describe("llm 카탈로그", () => {
    it("에이전트를 돌리는 기능마다 실행 한도를 적어 둔다", () => {
        for (const feature of ["chat", "recipe-scan", "title-suggestion", "task-cleanup"]) {
            const limits = featureLimits(feature);
            expect(limits.budgetUsd).toBeGreaterThan(0);
            expect(limits.maxTurns).toBeGreaterThan(0);
            // 도구를 부르는 에이전트 턴은 몇 분이 정상이라 벽시계는 넉넉해야 한다.
            expect(limits.deadlineMs).toBeGreaterThanOrEqual(180_000);
            if (limits.stallMs !== undefined) {
                // 벽시계보다 늦게 걸리는 멈춤 감시는 한 번도 걸리지 않는다.
                expect(limits.stallMs).toBeLessThan(limits.deadlineMs);
            }
        }
    });

    it("기능이 가리키는 모든 모델의 단가를 안다", () => {
        const catalog = loadLlmCatalog();
        for (const models of Object.values(catalog.features)) {
            for (const id of [models.default, ...models.allowed]) {
                expect(canEstimateCost(id)).toBe(true);
            }
        }
    });

    it("카탈로그에 없는 모델은 예산을 집행할 수 없다고 답한다", () => {
        expect(canEstimateCost("claude-unknown-9")).toBe(false);
        expect(estimateCostUsd("claude-unknown-9", {
            inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0,
        })).toBeNull();
    });

    it("날짜가 붙은 구체 버전도 별칭과 같은 단가로 환산한다", () => {
        const model = featureModels("chat")!.default;
        const usage = { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
        expect(estimateCostUsd(`${model}-20260101`, usage)).toBe(estimateCostUsd(model, usage));
        // 설정 저장은 카탈로그에 적힌 이름만 받으므로 구체 버전은 접수되지 않는다.
        expect(canEstimateCost(`${model}-20260101`)).toBe(false);
    });

    it("입력 백만 토큰의 비용이 카탈로그 단가와 같다", () => {
        const model = featureModels("chat")!.default;
        expect(estimateCostUsd(model, {
            inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0,
        })).toBe(loadLlmCatalog().models[model]!.input);
    });
});
