import { describe, expect, it } from "vitest";
import { AgentExecutionFailure } from "@tracer-agent/llm";
import { attemptRecordFromFailure, foldAttempt } from "~agent-worker/support/llm/job.attempt.js";
import { readJobFailedUsageRule } from "~agent-worker/support/contract.js";

const rule = readJobFailedUsageRule();

function failure(): AgentExecutionFailure {
    return new AgentExecutionFailure("title-suggestion", "AGENT_FAILED", "provider refused the call", {
        errorSubtype: "api_error",
        durationMs: 90,
        usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 },
        steps: [],
        actualModel: "claude-haiku-4-5",
        providerRequestId: "req-1",
    });
}

describe("끝내지 못한 잡의 사용량", () => {
    it("계약이 적은 모양 하나로 시도 이력을 싣는다", () => {
        const { attempts } = foldAttempt({}, attemptRecordFromFailure(1, failure()));

        expect(Object.keys({ [rule.shape]: attempts })).toEqual([rule.shape]);
    });

    it("시도 하나의 기록이 계약이 적은 칸을 그대로 갖는다", () => {
        const record = attemptRecordFromFailure(1, failure());

        expect(Object.keys(record).sort()).toEqual([...rule.fields].sort());
    });

    it("소진된 시도를 그 배열에 쌓는다", () => {
        const first = foldAttempt({}, attemptRecordFromFailure(1, failure()));
        const second = foldAttempt({ [rule.shape]: first.attempts }, attemptRecordFromFailure(2, failure()));

        expect(second.attempts.map((item) => item.attempt)).toEqual([1, 2]);
    });
});
