import { describe, expect, it } from "vitest";
import { partialAssistantDeltaText, type PartialAssistantStreamEvent } from "./claude.stream.delta.js";

describe("부분 어시스턴트 델타 추출", () => {
    it("text_delta 블록의 텍스트를 그대로 낸다", () => {
        const event = {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "hello" },
        } as PartialAssistantStreamEvent;
        expect(partialAssistantDeltaText(event)).toBe("hello");
    });

    it("텍스트가 아닌 델타는 빈 문자열로 무시한다", () => {
        const event = {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: "{" },
        } as PartialAssistantStreamEvent;
        expect(partialAssistantDeltaText(event)).toBe("");
    });

    it("델타가 아닌 스트림 이벤트는 빈 문자열로 무시한다", () => {
        const event = {
            type: "content_block_stop",
            index: 0,
        } as PartialAssistantStreamEvent;
        expect(partialAssistantDeltaText(event)).toBe("");
    });
});
