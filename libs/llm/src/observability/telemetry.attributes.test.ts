import { describe, expect, it } from "vitest";
import { AGENT_TRACER_ATTR } from "./semconv.const.js";
import {
    buildGenAiClientSpanAttributes,
    buildInvokeAgentSpanAttributes,
    buildToolSpanAttributes,
} from "./telemetry.attributes.js";

const observation = {
    executionId: "exec-1", attemptId: "attempt-1",
    promptVersion: "prompt-v1",
    toolContractVersion: "tools-v1", modelCallId: "call-1",
};

describe("공통 관측 span 속성", () => {
    it.each([
        buildInvokeAgentSpanAttributes({
            jobId: "job-1", jobKind: "title", agentName: "agent", backend: "claude-sdk", observation,
        }),
        buildGenAiClientSpanAttributes({
            operationName: "chat", provider: "anthropic", model: "claude", observation,
        }),
        buildToolSpanAttributes({ toolName: "search", observation }),
    ])("root와 model과 tool span에 같은 실행 식별자를 적용한다", (attributes) => {
        expect(attributes).toMatchObject({
            [AGENT_TRACER_ATTR.executionId]: "exec-1",
            [AGENT_TRACER_ATTR.attemptId]: "attempt-1",
            [AGENT_TRACER_ATTR.promptVersion]: "prompt-v1",
            [AGENT_TRACER_ATTR.toolContractVersion]: "tools-v1",
            [AGENT_TRACER_ATTR.modelCallId]: "call-1",
        });
    });

    it("입력하지 않은 식별자를 만들지 않는다", () => {
        expect(buildToolSpanAttributes({ toolName: "search" })).not.toHaveProperty(
            AGENT_TRACER_ATTR.executionId,
        );
    });
});
