import { describe, expect, it } from "vitest";
import { isNonRetryableSubtype, PROVIDER_ERROR_SUBTYPE } from "~llm/model/agent.error.js";
import { providerSubtypeFromTerminalReason } from "./claude.terminal.reason.js";

describe("SDK가 실행을 끝낸 까닭", () => {
    it("호출을 막은 한도를 공급자 한도 사유로 옮긴다", () => {
        expect(providerSubtypeFromTerminalReason("blocking_limit")).toBe(PROVIDER_ERROR_SUBTYPE.rateLimit);
    });

    it("급속 충전 차단기도 같은 사유로 옮긴다", () => {
        expect(providerSubtypeFromTerminalReason("rapid_refill_breaker")).toBe(
            PROVIDER_ERROR_SUBTYPE.rateLimit,
        );
    });

    it("입력이 창을 넘긴 것을 요청 과대로 옮긴다", () => {
        expect(providerSubtypeFromTerminalReason("prompt_too_long")).toBe(
            PROVIDER_ERROR_SUBTYPE.requestTooLarge,
        );
    });

    it.each(["max_turns", "budget_exhausted", "structured_output_retry_exhausted", "completed"])(
        "결과 서브타입이 이미 말하는 %s 는 옮기지 않는다",
        (reason) => {
            expect(providerSubtypeFromTerminalReason(reason)).toBeNull();
        },
    );

    it("까닭이 없으면 옮길 것이 없다", () => {
        expect(providerSubtypeFromTerminalReason(undefined)).toBeNull();
    });

    it("아직 표에 없는 까닭은 서브타입 판정에 맡긴다", () => {
        expect(providerSubtypeFromTerminalReason("turn_setup_failed")).toBeNull();
    });
});

// 옮겨 적는 목적은 재시도 판정을 바꾸는 것이므로 그 결과까지 묶어 둔다.
describe("옮겨 적은 사유가 받는 재시도 판정", () => {
    it("공급자 한도로 끝난 실행은 다시 시도한다", () => {
        const subtype = providerSubtypeFromTerminalReason("blocking_limit");

        expect(isNonRetryableSubtype(subtype)).toBe(false);
    });

    it("입력이 창을 넘긴 실행은 다시 시도하지 않는다", () => {
        const subtype = providerSubtypeFromTerminalReason("prompt_too_long");

        expect(isNonRetryableSubtype(subtype)).toBe(true);
    });
});
