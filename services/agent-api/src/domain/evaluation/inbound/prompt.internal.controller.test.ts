import { describe, expect, it, vi } from "vitest";
import type { RegisterAndResolvePromptFragmentsUseCase } from "~agent-api/domain/evaluation/application/command/register.and.resolve.prompt.fragments.usecase.js";
import type { RegisterBackendPromptUseCase } from "~agent-api/domain/evaluation/application/command/register.backend.prompt.usecase.js";
import { PromptInternalController } from "./prompt.internal.controller.js";
import { registerAndResolvePromptFragmentsSchema, registerBackendPromptSchema } from "./prompt.schema.js";

const MANIFEST_BODY = {
    profile: "local",
    manifest: [{
        backend: "claude-sdk", agentName: "chat", language: "en", codeName: "CHAT_MEMORY_RULE",
        definitionKey: "chat.memory-rule.en", fragmentName: "memoryRule", defaultVersion: "v1",
        defaultContent: "Save only stable preferences.", toolContractVersion: "1", outputSchemaVersion: "1",
        bindings: [{ templateKey: "chat.assistant.system", fragmentSlot: "memoryRule" }],
    }],
};

function controller(fragments = vi.fn(), backendPrompt = vi.fn()) {
    return {
        instance: new PromptInternalController(
            { execute: fragments } as unknown as RegisterAndResolvePromptFragmentsUseCase,
            { execute: backendPrompt } as unknown as RegisterBackendPromptUseCase,
        ),
        fragments,
        backendPrompt,
    };
}

describe("PromptInternalController", () => {
    it("매니페스트와 프로파일을 그대로 등록 유스케이스에 넘긴다", async () => {
        const { instance, fragments } = controller();
        const body = registerAndResolvePromptFragmentsSchema.parse(MANIFEST_BODY);
        await instance.fragments(body);
        expect(fragments).toHaveBeenCalledWith(body);
    });

    it("자기신고 헤더가 비면 프롬프트 등록이 기본 사용자로 간다", async () => {
        const { instance, backendPrompt } = controller();
        await instance.register("rust-agent", undefined, registerBackendPromptSchema.parse({
            name: "chat", agentName: "chat", language: "en",
            version: { semanticVersion: "v1", content: "본문", toolContractVersion: "1", outputSchemaVersion: "1" },
        }));
        expect(backendPrompt.mock.calls[0]?.[0]).toMatchObject({ userId: "local", backend: "rust-agent", agentName: "chat" });
    });

    it("처음 보는 백엔드 이름의 매니페스트를 받는다", () => {
        const body = { ...MANIFEST_BODY, manifest: [{ ...MANIFEST_BODY.manifest[0]!, backend: "rust-agent" }] };
        expect(registerAndResolvePromptFragmentsSchema.parse(body).manifest[0]?.backend).toBe("rust-agent");
    });

    it("문법을 어긴 백엔드 이름의 매니페스트를 거절한다", () => {
        const body = { ...MANIFEST_BODY, manifest: [{ ...MANIFEST_BODY.manifest[0]!, backend: "Rust_Agent" }] };
        expect(() => registerAndResolvePromptFragmentsSchema.parse(body)).toThrow();
    });

    it("바인딩이 빈 매니페스트 항목을 거절한다", () => {
        const body = { ...MANIFEST_BODY, manifest: [{ ...MANIFEST_BODY.manifest[0]!, bindings: [] }] };
        expect(() => registerAndResolvePromptFragmentsSchema.parse(body)).toThrow();
    });
});
