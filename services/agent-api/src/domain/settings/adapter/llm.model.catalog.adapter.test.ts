import { loadLlmCatalog } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { LlmModelCatalogAdapter } from "./llm.model.catalog.adapter.js";

describe("LlmModelCatalogAdapter", () => {
    it("단가표에 실린 모델을 전부 낸다", () => {
        const options = new LlmModelCatalogAdapter().list();

        expect(options.map((option) => option.id).sort()).toEqual(Object.keys(loadLlmCatalog().models).sort());
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
