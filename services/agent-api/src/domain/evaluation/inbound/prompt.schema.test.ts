import { describe, expect, it } from "vitest";
import { createPromptSchema, registerCandidateFragmentVersionSchema } from "./prompt.schema.js";

describe("promptSchema", () => {
    it("지원하는 backend의 프롬프트를 받는다", () => {
        expect(createPromptSchema.safeParse({
            name: "이름", agentName: "agent", backend: "claude-sdk", language: "ko",
            version: { semanticVersion: "1.0.0", content: "본문", toolContractVersion: "1", outputSchemaVersion: "1" },
        }).success).toBe(true);
    });

    it("빈 조각 본문을 거부한다", () => {
        expect(registerCandidateFragmentVersionSchema.safeParse({
            backend: "python", agentName: "agent", fragmentName: "role", language: "ko", content: "",
        }).success).toBe(false);
    });
});
