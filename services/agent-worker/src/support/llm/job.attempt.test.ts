import { AgentExecutionFailure } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { attemptRecordFromFailure, attemptRecordFromSuccess } from "./job.attempt.js";

const ALIAS = "claude-opus-5";
const DATED = `${ALIAS}-20260101`;

const USAGE = { inputTokens: 10, outputTokens: 10, cacheReadTokens: 0, cacheCreationTokens: 0 };

function failure(actualModel: string | null): AgentExecutionFailure {
    return new AgentExecutionFailure("chat", "AGENT_FAILED", "이유", {
        actualModel,
        errorSubtype: "budget_exhausted",
        durationMs: 1,
        usage: USAGE,
    });
}

describe("시도 이력의 모델 이름", () => {
    it("판까지 붙은 이름을 카탈로그의 별칭으로 되돌린다", () => {
        expect(attemptRecordFromFailure(1, failure(DATED)).model).toBe(ALIAS);
    });

    it("성공한 시도와 실패한 시도가 같은 이름을 남긴다", () => {
        const succeeded = attemptRecordFromSuccess(1, {
            modelUsed: ALIAS,
            costUsd: null,
            durationMs: 1,
            numTurns: 1,
            usage: USAGE,
        });

        expect(attemptRecordFromFailure(2, failure(DATED)).model).toBe(succeeded.model);
    });

    it("모델을 모르면 이름을 지어내지 않는다", () => {
        expect(attemptRecordFromFailure(1, failure(null)).model).toBeNull();
    });
});
