import { promptContentHash } from "~agent-api/domain/evaluation/model/prompt.hash.js";
import { PromptDefinition, PromptVersion } from "~agent-api/domain/evaluation/model/prompt.model.js";
import { FixedPromptClock, FixedPromptPromotionGate, InMemoryPromptRepository, SequentialPromptIdGenerator } from "~agent-api/domain/evaluation/port/__fakes__/prompt.fakes.js";

export const NOW = new Date("2026-01-01T00:00:00.000Z");
export const clock = () => new FixedPromptClock(NOW);
export const ids = () => new SequentialPromptIdGenerator();
export const gate = (passed = true) => new FixedPromptPromotionGate({
    passed, policyVersion: "gate/1", reasons: passed ? [] : ["failed"], evidence: {},
});
export function promptFixture() {
    const repository = new InMemoryPromptRepository();
    const definition = Object.assign(new PromptDefinition(), {
        id: "prompt-1", userId: "user-1", agentName: "investigator", backend: "claude-sdk",
        language: "ko", name: "조사", createdAt: NOW,
    });
    const version = Object.assign(new PromptVersion(), {
        id: "version-1", definitionId: definition.id, semanticVersion: "1.0.0", content: "본문",
        contentHash: promptContentHash("본문"), toolContractVersion: "1", outputSchemaVersion: "1",
        contentOrigin: "user-authored", createdBy: "user-1", createdAt: NOW,
    });
    repository.definitions.push(definition); repository.versions.push(version);
    return { repository, definition, version };
}
export const versionInput = {
    semanticVersion: "1.0.0", content: "본문", toolContractVersion: "1", outputSchemaVersion: "1",
};
