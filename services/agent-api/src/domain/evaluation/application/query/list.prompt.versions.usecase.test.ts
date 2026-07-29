import { describe, expect, it } from "vitest";
import { promptFixture } from "../prompt.test.fixture.js";
import { ListPromptVersionsUseCase } from "./list.prompt.versions.usecase.js";
describe("ListPromptVersionsUseCase", () => {
    it("정의에 속한 버전을 나열한다", async () => {
        const { repository, definition } = promptFixture();
        expect(await new ListPromptVersionsUseCase(repository).execute("user-1", definition.id)).toHaveLength(1);
    });
});
