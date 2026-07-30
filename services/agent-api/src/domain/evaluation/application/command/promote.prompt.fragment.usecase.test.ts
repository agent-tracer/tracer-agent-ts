import { describe, expect, it } from "vitest";
import type { PromptFragmentManifestEntry } from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import { InMemoryPromptRepository } from "~agent-api/domain/evaluation/port/__fakes__/prompt.fakes.js";
import { clock, ids } from "../prompt.test.fixture.js";
import { PromotePromptFragmentUseCase } from "./promote.prompt.fragment.usecase.js";
import { RegisterCandidateFragmentVersionUseCase } from "./register.candidate.fragment.version.usecase.js";

const SCOPE = { backend: "claude-sdk", agentName: "chat", fragmentName: "groundingRules", language: "en" } as const;
const MANIFEST: readonly PromptFragmentManifestEntry[] = [{
    ...SCOPE, codeName: "CHAT_GROUNDING_RULES", definitionKey: "chat.grounding-rules.en", defaultVersion: "v1",
    defaultContent: "코드가 정한 판", toolContractVersion: "1", outputSchemaVersion: "1",
    bindings: [{ templateKey: "chat.assistant.system", fragmentSlot: "groundingRules" }],
}];

async function declared() {
    const repository = new InMemoryPromptRepository();
    await repository.registerAndResolveFragments("prd", MANIFEST);
    return repository;
}

describe("PromotePromptFragmentUseCase", () => {
    it("승격이 조각 채널을 그 판으로 옮긴다", async () => {
        const repository = await declared();
        const candidate = await new RegisterCandidateFragmentVersionUseCase(repository, ids(), clock())
            .execute({ ...SCOPE, content: "작성한 판", changeSummary: null, createdBy: "u" });
        const promoted = await new PromotePromptFragmentUseCase(repository, ids(), clock())
            .execute({ definitionId: candidate.definitionId, versionId: candidate.versionId, channel: "production" });
        expect(promoted).toStrictEqual({
            definitionId: candidate.definitionId, channel: "production", versionId: candidate.versionId,
        });
        const resolved = await repository.registerAndResolveFragments("prd", MANIFEST);
        expect(resolved.map((item) => item.content)).toStrictEqual(["작성한 판"]);
        expect(resolved.map((item) => item.source)).toStrictEqual(["database-override"]);
    });

    it("같은 채널을 두 번 움직여도 행이 하나로 남는다", async () => {
        const repository = await declared();
        const register = new RegisterCandidateFragmentVersionUseCase(repository, ids(), clock());
        const first = await register.execute({ ...SCOPE, content: "첫 판", changeSummary: null, createdBy: "u" });
        const second = await register.execute({ ...SCOPE, content: "둘째 판", changeSummary: null, createdBy: "u" });
        const promote = new PromotePromptFragmentUseCase(repository, ids(), clock());
        await promote.execute({ definitionId: first.definitionId, versionId: first.versionId, channel: "production" });
        await promote.execute({ definitionId: second.definitionId, versionId: second.versionId, channel: "production" });
        expect(repository.fragmentChannels.filter((item) => item.channel === "production")).toHaveLength(1);
        expect((await repository.findFragmentChannel(first.definitionId, "production"))?.versionId).toBe(second.versionId);
    });

    it("그 정의의 판이 아니면 승격하지 않는다", async () => {
        const repository = await declared();
        await expect(new PromotePromptFragmentUseCase(repository, ids(), clock())
            .execute({ definitionId: "없는-정의", versionId: "없는-판", channel: "staging" })).rejects.toThrow();
    });
});
