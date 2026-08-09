import { describe, expect, it } from "vitest";
import { tracerApiError } from "./tracer.api.error.js";

describe("상류가 낸 거절", () => {
    it("원장을 얻지 못한 상류의 상태와 코드를 그대로 싣는다", () => {
        const error = tracerApiError(503, {
            ok: false,
            error: { code: "service_unavailable", message: "Ledger connection was not available" },
        }, "");

        expect(error.httpStatus).toBe(503);
        expect(error.code).toBe("service_unavailable");
    });

    it("봉투가 아닌 실패만 502로 접는다", () => {
        expect(tracerApiError(0, "boom", "boom").httpStatus).toBe(502);
    });
});
