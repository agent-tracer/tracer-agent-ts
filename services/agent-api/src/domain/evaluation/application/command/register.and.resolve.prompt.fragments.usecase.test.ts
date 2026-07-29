import { describe, expect, it } from "vitest";
import { InMemoryPromptRepository } from "~agent-api/domain/evaluation/port/__fakes__/prompt.fakes.js";
import { RegisterAndResolvePromptFragmentsUseCase } from "./register.and.resolve.prompt.fragments.usecase.js";
describe("RegisterAndResolvePromptFragmentsUseCase", () => {
    it("manifest 조각을 등록하고 해소한다", async () => {
        const result = await new RegisterAndResolvePromptFragmentsUseCase(new InMemoryPromptRepository()).execute({ profile: "default", manifest: [{
            templateKey: "sdk.task.agent.system", fragmentSlot: "role", agentName: "agent", backend: "claude-sdk",
            language: "ko", fragmentName: "role", codeName: "ROLE", semanticVersion: "1.0.0", content: "본문",
            toolContractVersion: "1", outputSchemaVersion: "1",
        }] });
        expect(result).toHaveLength(1);
    });
});
