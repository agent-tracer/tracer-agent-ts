import { AgentExecutionFailure } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { agentFailureAccounting } from "./agent.accounting.js";

const USAGE = {
    inputTokens: 1_000_000,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
};

function failure(detail: Record<string, unknown>): AgentExecutionFailure {
    return new AgentExecutionFailure("probe", "AGENT_FAILED", "조사가 무너졌다", detail);
}

describe("실패한 호출의 정산", () => {
    it("사용량을 보고했으면 그 사용량으로 비용을 셈한다", () => {
        const accounting = agentFailureAccounting(failure({ usage: USAGE }), "claude-haiku-4-5");

        expect(accounting.costUsd).toBe(1.0);
        expect(accounting.usage).toEqual(USAGE);
    });

    it("실제로 답한 모델이 있으면 그 모델의 단가를 쓴다", () => {
        const accounting = agentFailureAccounting(
            failure({ usage: USAGE, actualModel: "claude-sonnet-4-6" }),
            "claude-haiku-4-5",
        );

        expect(accounting.costUsd).toBe(3.0);
    });

    it("사용량을 모르면 비워 두어 몫 전부를 쓴 것으로 보게 한다", () => {
        const accounting = agentFailureAccounting(failure({}), "claude-haiku-4-5");

        expect(accounting.costUsd).toBeNull();
        expect(accounting.usage).toBeNull();
    });

    it("턴 수는 사용량으로 알 수 없으므로 언제나 비워 둔다", () => {
        const accounting = agentFailureAccounting(failure({ usage: USAGE }), "claude-haiku-4-5");

        expect(accounting.numTurns).toBeNull();
    });
});
