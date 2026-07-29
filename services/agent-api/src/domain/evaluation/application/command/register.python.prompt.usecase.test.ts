import { describe, expect, it } from "vitest";
import { InMemoryPromptRepository } from "~agent-api/domain/evaluation/port/__fakes__/prompt.fakes.js";
import { clock, ids, versionInput } from "../prompt.test.fixture.js";
import { RegisterPythonPromptUseCase } from "./register.python.prompt.usecase.js";
describe("RegisterPythonPromptUseCase", () => {
    it("Python 프롬프트를 production 채널에 등록한다", async () => {
        const repository = new InMemoryPromptRepository();
        const result = await new RegisterPythonPromptUseCase(repository, ids(), clock()).execute({ userId: "u", agentName: "agent", language: "ko", name: "이름", version: versionInput });
        expect(result.channel.channel).toBe("production");
    });
});
