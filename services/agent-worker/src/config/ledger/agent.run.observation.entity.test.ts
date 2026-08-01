import "reflect-metadata";
import { AGENT_BACKEND, type AgentRunObservation } from "@tracer-agent/llm";
import { getMetadataArgsStorage } from "typeorm";
import { describe, expect, it } from "vitest";
import { AgentRunObservationEntity, toAgentRunObservationRow } from "./agent.run.observation.entity.js";

const observation: AgentRunObservation = {
    executionId: "exec-1",
    attemptId: "1",
    jobId: "job-1",
    agentName: "title-suggestion",
    backend: AGENT_BACKEND,
    modelRequested: "claude-requested",
    modelActual: "claude-actual",
    promptVersion: "v3",
    toolContractVersion: "tools-v2",
    status: "succeeded",
    durationMs: 120,
    usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
    costUsd: 0.01,
    landed: true,
    repairAttempted: false,
    validation: { passed: true, errorCodes: [], citationPrecision: null, citationRecall: null },
    modelCalls: [],
    toolCalls: [],
};

function declaredColumns(): readonly string[] {
    return getMetadataArgsStorage()
        .filterColumns(AgentRunObservationEntity)
        .map((column) => column.propertyName)
        .sort();
}

describe("toAgentRunObservationRow", () => {
    it("원장이 선언한 칸을 하나도 빠뜨리지 않고 채운다", () => {
        const row = toAgentRunObservationRow("user-1", observation, new Date("2026-01-01T00:00:00Z"));

        expect(Object.keys(row).sort()).toEqual(declaredColumns());
    });

    it("실행과 시도와 사용자를 원장의 값으로 싣는다", () => {
        const row = toAgentRunObservationRow("user-1", observation, new Date("2026-01-01T00:00:00Z"));

        expect(row.executionId).toBe("exec-1");
        expect(row.attemptId).toBe("1");
        expect(row.userId).toBe("user-1");
        expect(row.jobId).toBe("job-1");
    });
});
