import { describe, expect, it } from "vitest";
import {
    RECIPES_INDEX_DEFINITION,
    type SearchIndexDefinition,
} from "~agent-api/domain/recipe/model/recipe.index.js";
import type { SearchIndexAdminPort } from "~agent-api/domain/recipe/port/search.index.admin.port.js";
import { EnsureRecipeIndexUseCase } from "./ensure.recipe.index.usecase.js";

/** 색인 관리자의 대역이며 실물이 하는 이미 있으면 넘어가기는 어댑터 테스트가 본다. */
class RecordingIndexAdmin implements SearchIndexAdminPort {
    readonly ensured: SearchIndexDefinition[] = [];

    failure: Error | null = null;

    ensureIndex(definition: SearchIndexDefinition): Promise<void> {
        if (this.failure !== null) return Promise.reject(this.failure);
        this.ensured.push(definition);
        return Promise.resolve();
    }
}

describe("레시피 색인 세우기", () => {
    it("계약이 선언한 색인 하나를 세운다", async () => {
        const admin = new RecordingIndexAdmin();

        await new EnsureRecipeIndexUseCase(admin).execute();

        expect(admin.ensured).toEqual([RECIPES_INDEX_DEFINITION]);
    });

    it("색인을 세우지 못하면 부팅이 멈추도록 실패를 올린다", async () => {
        const admin = new RecordingIndexAdmin();
        admin.failure = new Error("connect ECONNREFUSED");

        await expect(new EnsureRecipeIndexUseCase(admin).execute()).rejects.toThrow("ECONNREFUSED");
    });
});
