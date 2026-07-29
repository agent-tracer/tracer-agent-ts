import { describe, expect, it } from "vitest";
import { clock, gate, ids, promptFixture } from "../prompt.test.fixture.js";
import { PromotePromptUseCase } from "./promote.prompt.usecase.js";
describe("PromotePromptUseCase", () => {
    it("게이트를 통과한 버전을 production 채널에 올린다", async () => {
        const { repository, definition, version } = promptFixture();
        const result = await new PromotePromptUseCase(repository, ids(), clock(), gate()).execute({
            userId: "user-1", definitionId: definition.id, versionId: version.id, channel: "production", experimentId: "experiment-1",
        });
        expect(result.channel.versionId).toBe(version.id);
    });
});
