import { describe, expect, it } from "vitest";
import { clock, ids, promptFixture } from "../prompt.test.fixture.js";
import { PromotePromptUseCase } from "./promote.prompt.usecase.js";

describe("PromotePromptUseCase", () => {
    it("staging 을 지난 판을 production 채널에 올린다", async () => {
        const { repository, definition, version } = promptFixture();
        const promote = new PromotePromptUseCase(repository, ids(), clock());
        const target = { userId: "user-1", definitionId: definition.id, versionId: version.id, experimentId: "experiment-1" };
        await promote.execute({ ...target, channel: "staging" });
        const result = await promote.execute({ ...target, channel: "production" });
        expect(result.channel.versionId).toBe(version.id);
        expect(result.promotion.gateResult["passed"]).toBe(true);
        expect(result.promotion.experimentId).toBe("experiment-1");
    });

    it("staging 을 지나지 않은 판은 production 으로 올리지 않는다", async () => {
        const { repository, definition, version } = promptFixture();
        await expect(new PromotePromptUseCase(repository, ids(), clock()).execute({
            userId: "user-1", definitionId: definition.id, versionId: version.id, channel: "production",
            experimentId: "experiment-1",
        })).rejects.toThrow("Prompt promotion gate failed");
        expect(repository.channels).toHaveLength(0);
    });

    it("남의 정의의 판은 승격하지 않는다", async () => {
        const { repository, version } = promptFixture();
        await expect(new PromotePromptUseCase(repository, ids(), clock()).execute({
            userId: "user-1", definitionId: "다른-정의", versionId: version.id, channel: "staging",
            experimentId: "experiment-1",
        })).rejects.toThrow("Prompt version not found");
    });
});
