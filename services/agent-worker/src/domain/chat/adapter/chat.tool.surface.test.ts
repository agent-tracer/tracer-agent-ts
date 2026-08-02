import { describe, expect, it } from "vitest";
import { CHAT_TOOL_NAMES } from "~agent-worker/domain/chat/model/chat.tool.schema.js";
import { readContractJson } from "~agent-worker/support/contract.js";
import {
    chatAgentReadToolNames,
    chatMemoryToolNames,
    chatReadToolNames,
    chatWriteToolNames,
} from "./chat.tool.surface.js";

const DECLARED = readContractJson<{
    readonly tools: Readonly<Record<string, readonly string[]>>;
}>("conformance/cases/chat.tools.json").tools;

function registeredNames(): readonly string[] {
    return [
        ...chatReadToolNames(),
        ...chatAgentReadToolNames(),
        ...chatMemoryToolNames(),
        ...chatWriteToolNames(),
    ];
}

function sorted(names: readonly string[] | undefined): readonly string[] {
    return [...(names ?? [])].sort();
}

describe("대화 도구의 표면", () => {
    it("핸들러를 세우는 이름의 합이 계약의 도구 이름과 같다", () => {
        expect(sorted(registeredNames())).toEqual(sorted(CHAT_TOOL_NAMES));
    });

    it("한 도구가 두 표면에 함께 서지 않는다", () => {
        const registered = registeredNames();

        expect(new Set(registered).size).toBe(registered.length);
    });

    it("표면마다 파생한 이름이 적합성이 적은 목록과 같다", () => {
        expect(sorted(chatReadToolNames())).toEqual(sorted(DECLARED.read));
        expect(sorted(chatAgentReadToolNames())).toEqual(sorted(DECLARED.agentRead));
        expect(sorted(chatMemoryToolNames())).toEqual(sorted(DECLARED.memory));
        expect(sorted(chatWriteToolNames())).toEqual(sorted(DECLARED.confirm));
    });
});
