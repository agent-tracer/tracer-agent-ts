import { describe, expect, it } from "vitest";
import { backendNameSchema, createPromptSchema, registerCandidateFragmentVersionSchema } from "./prompt.schema.js";

describe("promptSchema", () => {
    it("처음 보는 백엔드 이름의 프롬프트를 받는다", () => {
        expect(createPromptSchema.safeParse({
            name: "이름", agentName: "agent", backend: "rust-agent", language: "ko",
            version: { semanticVersion: "1.0.0", content: "본문", toolContractVersion: "1", outputSchemaVersion: "1" },
        }).success).toBe(true);
    });

    it("빈 조각 본문을 거부한다", () => {
        expect(registerCandidateFragmentVersionSchema.safeParse({
            backend: "rust-agent", agentName: "agent", fragmentName: "role", language: "ko", content: "",
        }).success).toBe(false);
    });
});

describe("backendNameSchema", () => {
    it.each(["a", "rust-agent", "agent9", "a".repeat(64)])("문법을 지킨 이름 %s 를 받는다", (name) => {
        expect(backendNameSchema.safeParse(name).success).toBe(true);
    });

    it.each(["", "Rust", "9agent", "rust_agent", "-rust", "a".repeat(65)])("문법을 어긴 이름 %s 를 거절한다", (name) => {
        expect(backendNameSchema.safeParse(name).success).toBe(false);
    });
});
