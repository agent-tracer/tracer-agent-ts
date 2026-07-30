import { computePromptFragmentHash } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { InMemoryPromptRepository } from "~agent-api/domain/evaluation/port/__fakes__/prompt.fakes.js";
import { clock, ids, versionInput } from "../prompt.test.fixture.js";
import { CreatePromptUseCase } from "./create.prompt.usecase.js";
describe("CreatePromptUseCase", () => {
    it("프롬프트 정의와 첫 버전을 등록한다", async () => {
        const repository = new InMemoryPromptRepository();
        await new CreatePromptUseCase(repository, ids(), clock()).execute({ userId: "u", name: "이름", agentName: "agent", backend: "python", language: "ko", version: versionInput });
        expect(repository.definitions).toHaveLength(1); expect(repository.versions).toHaveLength(1);
    });

    it("저작한 본문의 해시를 등록 창구와 같은 규칙으로 낸다", async () => {
        const repository = new InMemoryPromptRepository();
        const content = "  café body\r\n";
        const { version } = await new CreatePromptUseCase(repository, ids(), clock())
            .execute({ userId: "u", name: "이름", agentName: "agent", backend: "python", language: "ko",
                version: { ...versionInput, content } });
        expect(version.contentHash).toBe(computePromptFragmentHash(content));
    });
});
