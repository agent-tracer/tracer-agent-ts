import { describe, expect, it } from "vitest";
import { AGENT_BACKEND } from "~llm/model/agent.axis.js";
import { AGENT_CALL_STATUS, AGENT_RUN_OBSERVATION_STATUS } from "~llm/model/agent.observation.js";
import type { JobStepPayload } from "~llm/model/job.step.js";
import type { AgentQueryResult } from "~llm/runner/llm.runner.js";
import { buildClaudeRunObservation } from "./agent.run.observation.js";

const steps: readonly JobStepPayload[] = [
    {
        seq: 0, role: "assistant", content: "", truncated: false, durationMs: 10,
        toolCalls: [{ id: "tool-1", name: "search", args: { secret: "must-not-leak" } }],
        stopReason: "tool_use",
    },
    {
        seq: 1, role: "tool", content: "private result", truncated: false, durationMs: 20,
        toolCalls: [], toolCallId: "tool-1", toolName: "search",
    },
    {
        seq: 2, role: "assistant", content: "answer", truncated: false, durationMs: 30,
        toolCalls: [], stopReason: "end_turn",
    },
];

function result(overrides: Partial<AgentQueryResult> = {}): AgentQueryResult {
    return {
        rawOutput: "raw private answer", structuredOutput: null, durationMs: 60, numTurns: 2,
        costUsd: 0.25, usage: { inputTokens: 10, outputTokens: 4, cacheReadTokens: 3, cacheCreationTokens: 2 },
        steps, errorSummary: null, errorSubtype: null, landed: false, actualModel: "claude-actual",
        providerRequestId: null, ttftMs: null, startupMs: null, ...overrides,
    };
}

const input = {
    executionId: "exec-1", attemptId: "attempt-1", jobId: "job-1",
    agentName: "title-suggestion",
    modelRequested: "claude-requested", promptVersion: "v3",
    toolContractVersion: "tools-v2", modelCallId: "model-call-1",
    repairAttempted: false,
    validation: { passed: true, errorCodes: [], citationPrecision: null, citationRecall: null },
} as const;

describe("buildClaudeRunObservation", () => {
    it("캐시 생성 토큰을 cache write로 정규화하고 공통 식별자를 모든 호출에 싣는다", () => {
        const observation = buildClaudeRunObservation(input, result());

        expect(observation).toMatchObject({
            executionId: "exec-1", attemptId: "attempt-1", backend: AGENT_BACKEND,
            status: AGENT_RUN_OBSERVATION_STATUS.succeeded,
            usage: { inputTokens: 10, outputTokens: 4, cacheReadTokens: 3, cacheWriteTokens: 2 },
        });
        expect(observation.modelCalls[0]).toMatchObject({
            executionId: "exec-1", attemptId: "attempt-1", modelCallId: "model-call-1",
            finishReason: "end_turn", status: AGENT_CALL_STATUS.succeeded,
        });
        expect(observation.toolCalls[0]).toEqual({
            executionId: "exec-1", attemptId: "attempt-1", toolCallId: "tool-1", toolName: "search",
            status: AGENT_CALL_STATUS.succeeded, durationMs: 20, errorType: null,
        });
    });

    it("원문 prompt와 출력과 도구 인자와 결과를 관측에 포함하지 않는다", () => {
        const serialized = JSON.stringify(buildClaudeRunObservation(input, result()));
        expect(serialized).not.toContain("must-not-leak");
        expect(serialized).not.toContain("private result");
        expect(serialized).not.toContain("raw private answer");
    });

    it("없는 modelCallId를 만들지 않고 deadline을 실패로 분류한다", () => {
        const { modelCallId: _modelCallId, ...withoutModelCallId } = input;
        const observation = buildClaudeRunObservation(
            withoutModelCallId,
            result({ errorSubtype: "deadline_exceeded", steps: [steps[0]!] }),
        );
        expect(observation.status).toBe(AGENT_RUN_OBSERVATION_STATUS.failed);
        expect(observation.modelCalls).toEqual([]);
        expect(observation.toolCalls[0]).toMatchObject({
            toolCallId: "tool-1", status: AGENT_CALL_STATUS.failed, errorType: "incomplete_tool_call",
        });
    });

    it("명시적인 cancelled subtype만 취소로 분류한다", () => {
        const observation = buildClaudeRunObservation(input, result({ errorSubtype: "cancelled" }));
        expect(observation.status).toBe(AGENT_RUN_OBSERVATION_STATUS.cancelled);
        expect(observation.modelCalls[0]?.status).toBe(AGENT_CALL_STATUS.cancelled);
    });
});
