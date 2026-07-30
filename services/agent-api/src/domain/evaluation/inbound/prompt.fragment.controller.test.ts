import { describe, expect, it, vi } from "vitest";
import type { PromotePromptFragmentUseCase } from "~agent-api/domain/evaluation/application/command/promote.prompt.fragment.usecase.js";
import type { RegisterCandidateFragmentVersionUseCase } from "~agent-api/domain/evaluation/application/command/register.candidate.fragment.version.usecase.js";
import type { ListPromptFragmentCatalogUseCase } from "~agent-api/domain/evaluation/application/query/list.prompt.fragment.catalog.usecase.js";
import { PromptFragmentController } from "./prompt.fragment.controller.js";
import { promotePromptFragmentSchema, registerCandidateFragmentVersionSchema } from "./prompt.schema.js";

const CANDIDATE_BODY = {
    backend: "claude-sdk", agentName: "chat", fragmentName: "memoryRule", language: "en",
    content: "작성한 판", changeSummary: "관문 확인",
};

function controller(catalog = vi.fn(), register = vi.fn(), promote = vi.fn()) {
    return {
        instance: new PromptFragmentController(
            { execute: catalog } as unknown as ListPromptFragmentCatalogUseCase,
            { execute: register } as unknown as RegisterCandidateFragmentVersionUseCase,
            { execute: promote } as unknown as PromotePromptFragmentUseCase,
        ),
        catalog,
        register,
        promote,
    };
}

describe("PromptFragmentController", () => {
    it("후보 본문에 자기신고 사용자를 붙여 등록 유스케이스에 넘긴다", async () => {
        const { instance, register } = controller();
        await instance.register("u2", registerCandidateFragmentVersionSchema.parse(CANDIDATE_BODY));
        expect(register).toHaveBeenCalledWith({ ...CANDIDATE_BODY, createdBy: "u2" });
    });

    it("자기신고 헤더가 비면 후보 등록이 기본 사용자로 간다", async () => {
        const { instance, register } = controller();
        await instance.register(undefined, registerCandidateFragmentVersionSchema.parse(CANDIDATE_BODY));
        expect(register.mock.calls[0]?.[0]).toMatchObject({ createdBy: "local" });
    });

    it("변경 요약이 없으면 null 로 채워 넘긴다", async () => {
        const { instance, register } = controller();
        const { changeSummary: _summary, ...rest } = CANDIDATE_BODY;
        await instance.register("u", registerCandidateFragmentVersionSchema.parse(rest));
        expect(register.mock.calls[0]?.[0]).toMatchObject({ changeSummary: null });
    });

    it("본문에 없는 칸을 실은 후보 등록을 거절한다", () => {
        expect(() => registerCandidateFragmentVersionSchema.parse({ ...CANDIDATE_BODY, createdBy: "u" })).toThrow();
    });

    it("경로의 정의와 본문의 판과 채널을 승격 유스케이스에 넘긴다", async () => {
        const { instance, promote } = controller();
        const body = promotePromptFragmentSchema.parse({ versionId: "version-1", channel: "production" });
        await instance.promoteVersion("definition-1", body);
        expect(promote).toHaveBeenCalledWith({
            definitionId: "definition-1", versionId: "version-1", channel: "production",
        });
    });

    it("계약이 선언하지 않은 채널로는 승격하지 않는다", () => {
        expect(() => promotePromptFragmentSchema.parse({ versionId: "version-1", channel: "canary" })).toThrow();
    });
});
