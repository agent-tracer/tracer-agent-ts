import { describe, expect, it } from "vitest";
import type { PromptFragmentManifestEntry } from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import { InMemoryPromptRepository } from "~agent-api/domain/evaluation/port/__fakes__/prompt.fakes.js";
import { clock, ids } from "../prompt.test.fixture.js";
import { RegisterCandidateFragmentVersionUseCase } from "./register.candidate.fragment.version.usecase.js";

const SCOPE = { backend: "claude-sdk", agentName: "chat", fragmentName: "role", language: "en" } as const;
const MANIFEST: readonly PromptFragmentManifestEntry[] = [{
    ...SCOPE, codeName: "CHAT_ROLE", definitionKey: "chat.role.en", defaultVersion: "v1",
    defaultContent: "코드가 정한 ${name}", toolContractVersion: "1", outputSchemaVersion: "1",
    bindings: [{ templateKey: "chat", fragmentSlot: "role" }],
}];

async function declared() {
    const repository = new InMemoryPromptRepository();
    await repository.registerAndResolveFragments("local", MANIFEST);
    return repository;
}

function usecase(repository: InMemoryPromptRepository) {
    return new RegisterCandidateFragmentVersionUseCase(repository, ids(), clock());
}

describe("RegisterCandidateFragmentVersionUseCase", () => {
    it("작성한 조각을 candidate 채널에 등록한다", async () => {
        const repository = await declared();
        const result = await usecase(repository).execute({ ...SCOPE, content: "${name}", changeSummary: "수정", createdBy: "u" });
        const channel = repository.fragmentChannels.find((item) => item.channel === "candidate");
        expect(channel?.versionId).toBe(result.versionId);
    });

    it("같은 조각을 두 번 등록해도 정의가 하나이고 판이 쌓인다", async () => {
        const repository = await declared();
        const first = await usecase(repository).execute({ ...SCOPE, content: "첫 판", changeSummary: null, createdBy: "u" });
        const second = await usecase(repository).execute({ ...SCOPE, content: "둘째 판", changeSummary: null, createdBy: "u" });
        expect(repository.fragmentDefinitions).toHaveLength(1);
        expect(first.definitionId).toBe(second.definitionId);
        expect([first.semanticVersion, second.semanticVersion]).toStrictEqual(["candidate-1", "candidate-2"]);
        expect(repository.fragmentChannels.filter((item) => item.channel === "candidate")).toHaveLength(1);
    });

    it("코드가 선언한 정의와 그 계약 판을 그대로 쓴다", async () => {
        const repository = await declared();
        const { definitionId, versionId } = await usecase(repository)
            .execute({ ...SCOPE, content: "본문", changeSummary: null, createdBy: "u" });
        const definition = repository.fragmentDefinitions.find((item) => item.id === definitionId);
        const version = repository.fragmentVersions.find((item) => item.id === versionId);
        expect(definition?.definitionKey).toBe("chat.role.en");
        expect(version?.toolContractVersion).toBe("1");
        expect(version?.outputSchemaVersion).toBe("1");
    });

    it("정의를 찾을 때 조각을 가르는 네 칸만 묻는다", async () => {
        const repository = await declared();
        const asked: object[] = [];
        const find = repository.findFragmentDefinition.bind(repository);
        repository.findFragmentDefinition = async (scope) => {
            asked.push(scope);
            return find(scope);
        };
        await usecase(repository).execute({ ...SCOPE, content: "본문", changeSummary: "요약", createdBy: "u" });
        expect(Object.keys(asked[0] ?? {}).sort())
            .toStrictEqual(["agentName", "backend", "fragmentName", "language"]);
    });

    it("코드가 선언하지 않은 조각은 등록하지 않는다", async () => {
        const repository = await declared();
        await expect(usecase(repository).execute({ ...SCOPE, fragmentName: "unknown", content: "본문", changeSummary: null, createdBy: "u" }))
            .rejects.toThrow();
    });
});
