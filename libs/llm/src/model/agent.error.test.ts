import { describe, expect, it } from "vitest";
import {
    AGENT_ERROR_SUBTYPE,
    AgentExecutionFailure,
    PROVIDER_ERROR_SUBTYPE,
    isBudgetExhaustedFailure,
    isNonRetryableSubtype,
    loadErrorSubtypeContract,
} from "./agent.error.js";

const CONTRACT = loadErrorSubtypeContract();

describe("isBudgetExhaustedFailure", () => {
    it("턴 예산 소진 실패를 예산 소진으로 본다", () => {
        const error = new AgentExecutionFailure("agent", "AGENT_FAILED", "boom", {
            errorSubtype: "max_turns_exceeded",
        });

        expect(isBudgetExhaustedFailure(error)).toBe(true);
    });

    it("비용 예산 소진 실패를 예산 소진으로 본다", () => {
        const error = new AgentExecutionFailure("agent", "AGENT_FAILED", "boom", {
            errorSubtype: "budget_exceeded",
        });

        expect(isBudgetExhaustedFailure(error)).toBe(true);
    });

    it("다른 실패 종류는 예산 소진으로 보지 않는다", () => {
        const error = new AgentExecutionFailure("agent", "OUTPUT_SCHEMA_INVALID", "boom", {
            errorSubtype: "output_schema_invalid",
        });

        expect(isBudgetExhaustedFailure(error)).toBe(false);
    });

    it("AgentExecutionFailure가 아닌 값은 예산 소진으로 보지 않는다", () => {
        expect(isBudgetExhaustedFailure(new Error("boom"))).toBe(false);
        expect(isBudgetExhaustedFailure("boom")).toBe(false);
    });
});

describe("오류 서브타입 계약", () => {
    it("이 백엔드가 내는 서브타입은 계약의 typescript 어휘와 같다", () => {
        const declared = Object.entries(CONTRACT.emitted)
            .filter(([, verdict]) => verdict.emittedBy.includes("typescript"))
            .map(([subtype]) => subtype);

        expect([...Object.values(AGENT_ERROR_SUBTYPE)].sort()).toEqual(declared.sort());
    });

    it("공급자 통과 값을 가리키는 이름도 계약의 표와 같다", () => {
        expect([...Object.values(PROVIDER_ERROR_SUBTYPE)].sort()).toEqual(Object.keys(CONTRACT.provider).sort());
    });

    it("이 구현이 이름 짓는 어휘와 공급자 통과 값이 겹치지 않는다", () => {
        const overlap = Object.keys(CONTRACT.provider).filter((subtype) => subtype in CONTRACT.emitted);

        expect(overlap).toEqual([]);
    });

    it("봉투를 다 쓴 실패와 분류되지 않은 실패를 재시도하지 않는다", () => {
        expect(isNonRetryableSubtype(AGENT_ERROR_SUBTYPE.deadlineExceeded)).toBe(true);
        expect(isNonRetryableSubtype(AGENT_ERROR_SUBTYPE.executionError)).toBe(true);
        expect(isNonRetryableSubtype(AGENT_ERROR_SUBTYPE.cancelled)).toBe(true);
    });

    it("공급자가 느렸을 뿐인 실패와 표에 없는 값은 재시도한다", () => {
        expect(isNonRetryableSubtype("connection_error")).toBe(false);
        expect(isNonRetryableSubtype("rate_limit_error")).toBe(false);
        expect(isNonRetryableSubtype("something_we_never_judged")).toBe(false);
        expect(isNonRetryableSubtype(null)).toBe(false);
    });

    it("파이썬만 내는 서브타입도 이 백엔드가 판정한다", () => {
        expect(isNonRetryableSubtype("max_tokens")).toBe(true);
        expect(isNonRetryableSubtype("authentication_error")).toBe(true);
    });
});
