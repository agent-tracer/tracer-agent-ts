import { describe, expect, it } from "vitest";
import { InMemoryPromptRepository } from "~agent-api/domain/evaluation/port/__fakes__/prompt.fakes.js";
import { clock, ids, versionInput } from "../prompt.test.fixture.js";
import { RegisterBackendPromptUseCase } from "./register.backend.prompt.usecase.js";
describe("RegisterBackendPromptUseCase", () => {
    it("자기를 이름 지은 백엔드의 프롬프트를 production 채널에 등록한다", async () => {
        const repository = new InMemoryPromptRepository();
        const result = await new RegisterBackendPromptUseCase(repository, ids(), clock()).execute({ userId: "u", backend: "rust-agent", agentName: "agent", language: "ko", name: "이름", version: versionInput });
        expect(result.channel.channel).toBe("production");
        expect(result.definition.backend).toBe("rust-agent");
    });
});
