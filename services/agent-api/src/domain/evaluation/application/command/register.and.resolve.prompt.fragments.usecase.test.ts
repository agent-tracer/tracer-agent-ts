import { computePromptFragmentHash } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { PromptFragmentVersion, type PromptFragmentManifestEntry } from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import { InMemoryPromptRepository } from "~agent-api/domain/evaluation/port/__fakes__/prompt.fakes.js";
import { RegisterAndResolvePromptFragmentsUseCase } from "./register.and.resolve.prompt.fragments.usecase.js";

const ENTRY: PromptFragmentManifestEntry = {
    backend: "claude-sdk",
    agentName: "chat",
    language: "en",
    codeName: "SDK_CHAT_MEMORY_RULE",
    definitionKey: "sdk.chat.memory-rule.en",
    fragmentName: "memoryRule",
    defaultVersion: "v1",
    defaultContent: "Save only stable preferences about ${user}.",
    toolContractVersion: "1",
    outputSchemaVersion: "1",
    bindings: [{ templateKey: "sdk.chat.assistant.system", fragmentSlot: "memoryRule" }],
};

describe("RegisterAndResolvePromptFragmentsUseCase", () => {
    it("파일 기본값을 심고 그 판을 이번 실행의 조각으로 낸다", async () => {
        const repository = new InMemoryPromptRepository();
        const [fragment] = await new RegisterAndResolvePromptFragmentsUseCase(repository)
            .execute({ profile: "local", manifest: [ENTRY] });
        expect(fragment).toMatchObject({
            templateKey: "sdk.chat.assistant.system", fragmentSlot: "memoryRule",
            definitionKey: "sdk.chat.memory-rule.en", codeName: "SDK_CHAT_MEMORY_RULE", semanticVersion: "v1",
            content: ENTRY.defaultContent, contentHash: computePromptFragmentHash(ENTRY.defaultContent),
            placeholders: ["user"], source: "code-default",
        });
        expect(repository.fragmentBindings).toHaveLength(1);
        expect(repository.fragmentChannels[0]).toMatchObject({ channel: "production" });
    });

    it("두 번째 부팅이 심어진 정의와 판을 그대로 다시 쓴다", async () => {
        const repository = new InMemoryPromptRepository();
        const usecase = new RegisterAndResolvePromptFragmentsUseCase(repository);
        const [first] = await usecase.execute({ profile: "prd", manifest: [ENTRY] });
        const [second] = await usecase.execute({ profile: "prd", manifest: [ENTRY] });
        expect(second?.versionId).toBe(first?.versionId);
        expect(repository.fragmentDefinitions).toHaveLength(1);
        expect(repository.fragmentVersions).toHaveLength(1);
    });

    it("production 채널이 가리키는 사람이 쓴 판을 파일 기본값 대신 낸다", async () => {
        const repository = new InMemoryPromptRepository();
        const usecase = new RegisterAndResolvePromptFragmentsUseCase(repository);
        await usecase.execute({ profile: "prd", manifest: [ENTRY] });
        repository.fragmentVersions.push(Object.assign(new PromptFragmentVersion(), {
            ...repository.fragmentVersions[0]!, id: "authored", semanticVersion: "v2",
            content: "Authored body.", contentHash: computePromptFragmentHash("Authored body."),
            placeholders: [], origin: "database-authored",
        }));
        repository.fragmentChannels[0]!.versionId = "authored";
        const [resolved] = await usecase.execute({ profile: "local", manifest: [ENTRY] });
        expect(resolved).toMatchObject({
            versionId: "authored", semanticVersion: "v2", content: "Authored body.", source: "database-override",
        });
    });

    it("production 채널 행이 없는 조각을 응답에 싣지 않는다", async () => {
        const repository = new InMemoryPromptRepository();
        const usecase = new RegisterAndResolvePromptFragmentsUseCase(repository);
        await usecase.execute({ profile: "local", manifest: [ENTRY] });
        repository.fragmentChannels[0]!.channel = "candidate";
        expect(await usecase.execute({ profile: "local", manifest: [ENTRY] })).toHaveLength(0);
    });
});
