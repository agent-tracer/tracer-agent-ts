import { describe, expect, it } from "vitest";
import { contractArgMaxLength } from "@tracer-agent/llm";
import { CHAT_TOOL_CONTRACT } from "~agent-api/domain/chat/model/chat.tool.schema.js";
import { rememberFactBodySchema } from "./chat.memory.schema.js";

const MAX = contractArgMaxLength(CHAT_TOOL_CONTRACT, "remember_fact", "content");

describe("계약이 적은 사실의 길이 상한", () => {
    it("계약이 그 수를 갖는다", () => {
        expect(MAX).toBeGreaterThan(0);
    });

    // 스키마는 이 수를 강제하지 못하므로 모델은 설명으로만 그것을 안다.
    it("도구 설명이 그 수를 모델에게 싣는다", () => {
        expect(CHAT_TOOL_CONTRACT.tools["remember_fact"]?.args["content"]?.description)
            .toContain(String(MAX));
    });

    it("상한만큼의 사실을 받는다", () => {
        expect(rememberFactBodySchema.safeParse({ content: "가".repeat(MAX) }).success).toBe(true);
    });

    it("상한을 한 글자 넘긴 사실을 거절한다", () => {
        expect(rememberFactBodySchema.safeParse({ content: "가".repeat(MAX + 1) }).success).toBe(false);
    });
});
