import { describe, expect, it } from "vitest";
import { promptFixture } from "../prompt.test.fixture.js";
import { ListPromptsUseCase } from "./list.prompts.usecase.js";
describe("ListPromptsUseCase", () => {
    it("사용자가 소유한 프롬프트만 나열한다", async () => {
        const { repository } = promptFixture();
        expect(await new ListPromptsUseCase(repository).execute("user-1")).toHaveLength(1);
    });
});
