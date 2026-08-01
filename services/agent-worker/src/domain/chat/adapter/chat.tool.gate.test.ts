import { describe, expect, it } from "vitest";
import { CHAT_TOOL_NAMES } from "~agent-worker/domain/chat/model/chat.tool.schema.js";
import {
    chatAgentReadToolNames,
    chatReadToolNames,
    chatWriteToolNames,
    CHAT_MEMORY_TOOLS,
} from "./chat.tool.gate.js";

describe("대화 도구 게이트", () => {
    it("핸들러를 세우는 이름의 합이 계약의 도구 이름과 같다", () => {
        const registered = [
            ...chatReadToolNames(),
            ...chatAgentReadToolNames(),
            ...CHAT_MEMORY_TOOLS,
            ...chatWriteToolNames(),
        ];

        expect([...registered].sort()).toEqual([...CHAT_TOOL_NAMES].sort());
    });

    it("한 도구가 두 게이트에 함께 서지 않는다", () => {
        const registered = [
            ...chatReadToolNames(),
            ...chatAgentReadToolNames(),
            ...CHAT_MEMORY_TOOLS,
            ...chatWriteToolNames(),
        ];

        expect(new Set(registered).size).toBe(registered.length);
    });
});
