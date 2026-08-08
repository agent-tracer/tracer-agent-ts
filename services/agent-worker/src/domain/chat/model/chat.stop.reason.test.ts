import { AGENT_ERROR_SUBTYPE } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { CHAT_STOP_REASON } from "./chat.const.js";
import { chatStopReason, type TurnStopSignals } from "./chat.stop.reason.js";

function signals(overrides: Partial<TurnStopSignals> = {}): TurnStopSignals {
    return { errorSubtype: null, errorSummary: null, landed: false, ...overrides };
}

describe("대화 턴이 왜 멈췄는지", () => {
    it("아무 신호도 없으면 끝까지 답한 것으로 적는다", () => {
        expect(chatStopReason(signals())).toBe(CHAT_STOP_REASON.completed);
    });

    it("예산을 거두고 결론만 받은 턴은 실패가 아니라 종료로 적는다", () => {
        expect(chatStopReason(signals({ landed: true }))).toBe(CHAT_STOP_REASON.budgetLanded);
    });

    it.each([
        [AGENT_ERROR_SUBTYPE.deadlineExceeded, CHAT_STOP_REASON.deadline],
        [AGENT_ERROR_SUBTYPE.maxTurnsExceeded, CHAT_STOP_REASON.turnLimit],
        [AGENT_ERROR_SUBTYPE.budgetExceeded, CHAT_STOP_REASON.budgetLanded],
        [AGENT_ERROR_SUBTYPE.cancelled, CHAT_STOP_REASON.canceled],
    ])("이름 붙은 중단 %s 는 그 사유로 적는다", (subtype, expected) => {
        expect(chatStopReason(signals({ errorSubtype: subtype }))).toBe(expected);
    });

    // max_tokens 는 계약상 Python 축만 내므로 이 갈래는 그 축의 실행을 받을 때 닿는다.
    it("이 축이 내지 않는 소진 서브타입이 와도 예산이 다한 부류면 종료로 접는다", () => {
        expect(chatStopReason(signals({ errorSubtype: "max_tokens" }))).toBe(
            CHAT_STOP_REASON.budgetLanded,
        );
    });

    it("그 밖의 서브타입은 실패로 적는다", () => {
        expect(chatStopReason(signals({ errorSubtype: AGENT_ERROR_SUBTYPE.executionError }))).toBe(
            CHAT_STOP_REASON.failed,
        );
    });

    it("서브타입이 요약보다 먼저 판정을 가져간다", () => {
        const reason = chatStopReason(
            signals({ errorSubtype: AGENT_ERROR_SUBTYPE.deadlineExceeded, errorSummary: "무언가 틀어졌다" }),
        );

        expect(reason).toBe(CHAT_STOP_REASON.deadline);
    });

    it("서브타입이 없고 요약만 있으면 실패로 적는다", () => {
        expect(chatStopReason(signals({ errorSummary: "무언가 틀어졌다" }))).toBe(CHAT_STOP_REASON.failed);
    });

    it("요약이 있으면 종료 표시보다 실패를 앞세운다", () => {
        expect(chatStopReason(signals({ errorSummary: "무언가 틀어졌다", landed: true }))).toBe(
            CHAT_STOP_REASON.failed,
        );
    });
});
