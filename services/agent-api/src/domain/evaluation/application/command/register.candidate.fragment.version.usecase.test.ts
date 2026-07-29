import { describe, expect, it } from "vitest";
import { InMemoryPromptRepository } from "~agent-api/domain/evaluation/port/__fakes__/prompt.fakes.js";
import { clock, ids } from "../prompt.test.fixture.js";
import { RegisterCandidateFragmentVersionUseCase } from "./register.candidate.fragment.version.usecase.js";
describe("RegisterCandidateFragmentVersionUseCase", () => {
    it("작성한 조각을 candidate 채널에 등록한다", async () => {
        const repository = new InMemoryPromptRepository();
        await new RegisterCandidateFragmentVersionUseCase(repository, ids(), clock()).execute({ backend: "python", agentName: "agent", fragmentName: "role", language: "ko", content: "${name}", changeSummary: "수정", createdBy: "u" });
        expect(repository.fragmentChannels[0]?.channel).toBe("candidate");
    });
});
