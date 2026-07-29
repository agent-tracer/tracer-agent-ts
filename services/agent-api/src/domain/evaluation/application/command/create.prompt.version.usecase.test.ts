import { describe, expect, it } from "vitest";
import { clock, ids, promptFixture, versionInput } from "../prompt.test.fixture.js";
import { CreatePromptVersionUseCase } from "./create.prompt.version.usecase.js";
describe("CreatePromptVersionUseCase", () => {
    it("소유한 정의에 새 버전을 등록한다", async () => {
        const { repository, definition } = promptFixture();
        await new CreatePromptVersionUseCase(repository, ids(), clock()).execute({ userId: "user-1", definitionId: definition.id, version: { ...versionInput, semanticVersion: "1.1.0" } });
        expect(repository.versions).toHaveLength(2);
    });
});
