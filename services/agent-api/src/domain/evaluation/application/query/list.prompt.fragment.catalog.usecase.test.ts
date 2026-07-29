import { describe, expect, it } from "vitest";
import { InMemoryPromptRepository } from "~agent-api/domain/evaluation/port/__fakes__/prompt.fakes.js";
import { ListPromptFragmentCatalogUseCase } from "./list.prompt.fragment.catalog.usecase.js";
describe("ListPromptFragmentCatalogUseCase", () => {
    it("조건에 맞는 조각 목록을 조회한다", async () => {
        expect(await new ListPromptFragmentCatalogUseCase(new InMemoryPromptRepository()).execute({ backend: "python" })).toEqual([]);
    });
});
