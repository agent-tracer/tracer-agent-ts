import { describe, expect, it } from "vitest";
import { searchQuerySchema } from "~agent-api/domain/recipe/inbound/recipe.schema.js";

describe("레시피 검색 질의 스키마", () => {
    it("공백뿐인 질의를 거절하지 않고 다듬어 넘긴다", () => {
        const parsed = searchQuerySchema.parse({ q: "   " });

        expect(parsed.q).toBe("");
    });

    it("빈 글자의 질의는 거절한다", () => {
        expect(() => searchQuerySchema.parse({ q: "" })).toThrow();
    });

    it("질의의 앞뒤 공백을 다듬어 넘긴다", () => {
        const parsed = searchQuerySchema.parse({ q: "  빌드  " });

        expect(parsed.q).toBe("빌드");
    });
});
