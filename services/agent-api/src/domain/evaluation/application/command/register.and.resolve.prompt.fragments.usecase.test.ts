import { computePromptFragmentHash } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { PromptFragmentVersion, type PromptFragmentManifestEntry } from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import { InMemoryPromptRepository } from "~agent-api/domain/evaluation/port/__fakes__/prompt.fakes.js";
import { RegisterAndResolvePromptFragmentsUseCase } from "./register.and.resolve.prompt.fragments.usecase.js";

const ENTRY: PromptFragmentManifestEntry = {
    backend: "claude-sdk",
    agentName: "chat",
    language: "en",
    codeName: "CHAT_MEMORY_RULE",
    definitionKey: "chat.memory-rule.en",
    fragmentName: "memoryRule",
    defaultVersion: "v1",
    defaultContent: "Save only stable preferences about ${user}.",
    toolContractVersion: "1",
    outputSchemaVersion: "1",
    bindings: [{ templateKey: "chat.assistant.system", fragmentSlot: "memoryRule" }],
};

/** 같은 에이전트의 같은 자리를 다른 축이 올린 항목이며 키가 두 항목에서 같다. */
const OTHER_BACKEND_ENTRY: PromptFragmentManifestEntry = {
    ...ENTRY, backend: "python", defaultContent: "다른 축의 판",
};

describe("RegisterAndResolvePromptFragmentsUseCase", () => {
    it("파일 기본값을 심고 그 판을 이번 실행의 조각으로 낸다", async () => {
        const repository = new InMemoryPromptRepository();
        const [fragment] = await new RegisterAndResolvePromptFragmentsUseCase(repository)
            .execute({ profile: "local", manifest: [ENTRY] });
        expect(fragment).toMatchObject({
            templateKey: "chat.assistant.system", fragmentSlot: "memoryRule",
            definitionKey: "chat.memory-rule.en", codeName: "CHAT_MEMORY_RULE", semanticVersion: "v1",
            content: ENTRY.defaultContent, contentHash: computePromptFragmentHash(ENTRY.defaultContent),
            placeholders: ["user"], source: "code-default",
        });
        expect(repository.fragmentBindings).toHaveLength(1);
        expect(repository.fragmentChannels[0]).toMatchObject({ channel: "staging" });
    });

    it("prd 프로파일이 production 채널에 판을 심는다", async () => {
        const repository = new InMemoryPromptRepository();
        await new RegisterAndResolvePromptFragmentsUseCase(repository).execute({ profile: "prd", manifest: [ENTRY] });
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

    it("채널이 가리키는 사람이 쓴 판을 파일 기본값 대신 낸다", async () => {
        const repository = new InMemoryPromptRepository();
        const usecase = new RegisterAndResolvePromptFragmentsUseCase(repository);
        await usecase.execute({ profile: "prd", manifest: [ENTRY] });
        repository.fragmentVersions.push(Object.assign(new PromptFragmentVersion(), {
            ...repository.fragmentVersions[0]!, id: "authored", semanticVersion: "v2",
            content: "Authored body.", contentHash: computePromptFragmentHash("Authored body."),
            placeholders: [], origin: "database-authored",
        }));
        repository.fragmentChannels[0]!.versionId = "authored";
        const [resolved] = await usecase.execute({ profile: "prd", manifest: [ENTRY] });
        expect(resolved).toMatchObject({
            versionId: "authored", semanticVersion: "v2", content: "Authored body.", source: "database-override",
        });
    });

    it("두 축이 같은 자리를 올려도 정의와 자리가 축마다 따로 남는다", async () => {
        const repository = new InMemoryPromptRepository();
        const usecase = new RegisterAndResolvePromptFragmentsUseCase(repository);
        const [mine] = await usecase.execute({ profile: "prd", manifest: [ENTRY] });
        const [theirs] = await usecase.execute({ profile: "prd", manifest: [OTHER_BACKEND_ENTRY] });
        expect(repository.fragmentDefinitions).toHaveLength(2);
        expect(repository.fragmentBindings).toHaveLength(2);
        expect(mine?.content).toBe(ENTRY.defaultContent);
        expect(theirs?.content).toBe(OTHER_BACKEND_ENTRY.defaultContent);
        expect(mine?.definitionId).not.toBe(theirs?.definitionId);
    });

    it("한 축의 승격이 다른 축이 실행에 쓰는 판을 건드리지 않는다", async () => {
        const repository = new InMemoryPromptRepository();
        const usecase = new RegisterAndResolvePromptFragmentsUseCase(repository);
        await usecase.execute({ profile: "prd", manifest: [ENTRY, OTHER_BACKEND_ENTRY] });
        const mine = repository.fragmentDefinitions.find((item) => item.backend === "claude-sdk")!;
        repository.fragmentVersions.push(Object.assign(new PromptFragmentVersion(), {
            ...repository.fragmentVersions[0]!, id: "authored", definitionId: mine.id, semanticVersion: "v2",
            content: "내 축만 바뀐 판", contentHash: computePromptFragmentHash("내 축만 바뀐 판"),
            placeholders: [], origin: "database-authored",
        }));
        const assignment = (await repository.findFragmentChannel(mine.id, "production"))!;
        await repository.saveFragmentChannel(Object.assign(assignment, { versionId: "authored" }));
        const resolved = await usecase.execute({ profile: "prd", manifest: [ENTRY, OTHER_BACKEND_ENTRY] });
        expect(resolved.map((item) => item.content))
            .toStrictEqual(["내 축만 바뀐 판", OTHER_BACKEND_ENTRY.defaultContent]);
    });
});
