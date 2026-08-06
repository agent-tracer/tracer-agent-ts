import { offeredModelIds } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { LlmModelCatalogAdapter } from "./llm.model.catalog.adapter.js";

describe("LlmModelCatalogAdapter", () => {
    it("잡이 모두 함께 허용하는 모델만 낸다", () => {
        // 설정이 하나뿐이라 어느 한 종류라도 막는 모델을 내면 고른 값이 그 종류에 걸리지 않는다.
        const options = new LlmModelCatalogAdapter().list();

        expect(options.map((option) => option.id).sort()).toEqual([...offeredModelIds()].sort());
    });

    it("어느 잡도 허용하지 않는 모델은 내지 않는다", () => {
        const ids = new LlmModelCatalogAdapter().list().map((option) => option.id);

        expect(ids).not.toContain("claude-opus-5");
    });

    it("모델마다 사람이 읽는 이름을 함께 낸다", () => {
        for (const option of new LlmModelCatalogAdapter().list()) {
            expect(option.label.length).toBeGreaterThan(0);
        }
    });

    it("모델을 식별자 순서로 낸다", () => {
        const ids = new LlmModelCatalogAdapter().list().map((option) => option.id);

        expect(ids).toEqual([...ids].sort((left, right) => left.localeCompare(right)));
    });
});
