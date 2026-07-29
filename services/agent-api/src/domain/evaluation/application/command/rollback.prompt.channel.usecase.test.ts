import { describe, expect, it } from "vitest";
import { PromptChannelAssignment } from "~agent-api/domain/evaluation/model/prompt.model.js";
import { clock, ids, promptFixture } from "../prompt.test.fixture.js";
import { RollbackPromptChannelUseCase } from "./rollback.prompt.channel.usecase.js";
describe("RollbackPromptChannelUseCase", () => {
    it("채널을 선택한 버전으로 되돌린다", async () => {
        const { repository, definition, version } = promptFixture();
        repository.channels.push(Object.assign(new PromptChannelAssignment(), { id: "channel-1", definitionId: definition.id, channel: "staging", versionId: "other", updatedAt: clock().now() }));
        const result = await new RollbackPromptChannelUseCase(repository, ids(), clock()).execute({ userId: "user-1", definitionId: definition.id, versionId: version.id, channel: "staging" });
        expect(result.channel.versionId).toBe(version.id);
    });
});
