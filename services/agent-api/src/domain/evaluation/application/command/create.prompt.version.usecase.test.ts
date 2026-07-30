import { computePromptFragmentHash } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { clock, ids, promptFixture, versionInput } from "../prompt.test.fixture.js";
import { CreatePromptVersionUseCase } from "./create.prompt.version.usecase.js";
describe("CreatePromptVersionUseCase", () => {
    it("소유한 정의에 새 버전을 등록한다", async () => {
        const { repository, definition } = promptFixture();
        await new CreatePromptVersionUseCase(repository, ids(), clock()).execute({ userId: "user-1", definitionId: definition.id, version: { ...versionInput, semanticVersion: "1.1.0" } });
        expect(repository.versions).toHaveLength(2);
    });

    it("저작한 본문의 해시를 등록 창구와 같은 규칙으로 낸다", async () => {
        const { repository, definition } = promptFixture();
        const content = "  cafe\u0301 body\r\n";
        const version = await new CreatePromptVersionUseCase(repository, ids(), clock())
            .execute({ userId: "user-1", definitionId: definition.id, version: { ...versionInput, semanticVersion: "1.1.0", content } });
        expect(version.contentHash).toBe(computePromptFragmentHash(content));
    });
});
