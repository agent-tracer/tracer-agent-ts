import { describe, expect, it, vi } from "vitest";
import type { RegisterAndResolvePromptFragmentsUseCase } from "~agent-api/domain/evaluation/application/command/register.and.resolve.prompt.fragments.usecase.js";
import type { RegisterPythonPromptUseCase } from "~agent-api/domain/evaluation/application/command/register.python.prompt.usecase.js";
import { PromptInternalController } from "./prompt.internal.controller.js";
import { registerAndResolvePromptFragmentsSchema, registerPythonPromptSchema } from "./prompt.schema.js";

const MANIFEST_BODY = {
    profile: "local",
    manifest: [{
        backend: "claude-sdk", agentName: "chat", language: "en", codeName: "CHAT_MEMORY_RULE",
        definitionKey: "chat.memory-rule.en", fragmentName: "memoryRule", defaultVersion: "v1",
        defaultContent: "Save only stable preferences.", toolContractVersion: "1", outputSchemaVersion: "1",
        bindings: [{ templateKey: "chat.assistant.system", fragmentSlot: "memoryRule" }],
    }],
};

function controller(fragments = vi.fn(), python = vi.fn()) {
    return {
        instance: new PromptInternalController(
            { execute: fragments } as unknown as RegisterAndResolvePromptFragmentsUseCase,
            { execute: python } as unknown as RegisterPythonPromptUseCase,
        ),
        fragments,
        python,
    };
}

describe("PromptInternalController", () => {
    it("매니페스트와 프로파일을 그대로 등록 유스케이스에 넘긴다", async () => {
        const { instance, fragments } = controller();
        const body = registerAndResolvePromptFragmentsSchema.parse(MANIFEST_BODY);
        await instance.fragments(body);
        expect(fragments).toHaveBeenCalledWith(body);
    });

    it("자기신고 헤더가 비면 python 등록이 기본 사용자로 간다", async () => {
        const { instance, python } = controller();
        await instance.register(undefined, registerPythonPromptSchema.parse({
            name: "chat", agentName: "chat", language: "en",
            version: { semanticVersion: "v1", content: "본문", toolContractVersion: "1", outputSchemaVersion: "1" },
        }));
        expect(python.mock.calls[0]?.[0]).toMatchObject({ userId: "local", agentName: "chat" });
    });

    it("바인딩이 빈 매니페스트 항목을 거절한다", () => {
        const body = { ...MANIFEST_BODY, manifest: [{ ...MANIFEST_BODY.manifest[0]!, bindings: [] }] };
        expect(() => registerAndResolvePromptFragmentsSchema.parse(body)).toThrow();
    });
});
