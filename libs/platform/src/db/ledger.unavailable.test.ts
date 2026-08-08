import { describe, expect, it } from "vitest";
import {
    isLedgerAcquisitionFailure,
    LedgerUnavailableError,
    translatingLedgerUnavailable,
} from "./ledger.unavailable.js";

const ACQUIRE_TIMEOUT = new Error("timeout exceeded when trying to connect");

describe("연결 획득 실패를 알아보는 자리", () => {
    it("연결을 못 받은 실패를 알아본다", () => {
        expect(isLedgerAcquisitionFailure(ACQUIRE_TIMEOUT)).toBe(true);
    });

    it("풀이 닫힌 뒤의 요구도 같은 실패로 본다", () => {
        expect(isLedgerAcquisitionFailure(new Error("Cannot use a pool after calling end on the pool"))).toBe(true);
    });

    it("드라이버 오류를 한 겹 감싼 모양도 알아본다", () => {
        expect(isLedgerAcquisitionFailure({ message: "query failed", driverError: ACQUIRE_TIMEOUT })).toBe(true);
    });

    it("이미 번역한 오류를 다시 알아본다", () => {
        expect(isLedgerAcquisitionFailure(new LedgerUnavailableError())).toBe(true);
    });

    it("다른 원장 실패는 이 자리로 보내지 않는다", () => {
        expect(isLedgerAcquisitionFailure(new Error("duplicate key value violates unique constraint"))).toBe(false);
    });

    it("오류가 아닌 값에 걸리지 않는다", () => {
        expect(isLedgerAcquisitionFailure(null)).toBe(false);
        expect(isLedgerAcquisitionFailure("timeout exceeded when trying to connect")).toBe(false);
    });
});

describe("원장에 닿는 일을 감싸는 자리", () => {
    it("성공한 일의 결과를 그대로 낸다", async () => {
        expect(await translatingLedgerUnavailable(() => Promise.resolve("적었다"))).toBe("적었다");
    });

    it("연결 획득 실패만 부르는 쪽이 아는 오류로 번역한다", async () => {
        await expect(translatingLedgerUnavailable(() => Promise.reject(ACQUIRE_TIMEOUT)))
            .rejects.toBeInstanceOf(LedgerUnavailableError);
    });

    it("번역한 오류가 원인을 잃지 않는다", async () => {
        const error = await translatingLedgerUnavailable(() => Promise.reject(ACQUIRE_TIMEOUT)).catch((caught: unknown) => caught);

        expect((error as LedgerUnavailableError).cause).toBe(ACQUIRE_TIMEOUT);
    });

    it("나머지 실패는 그대로 올린다", async () => {
        const other = new Error("원장이 다른 이유로 거절했다");

        await expect(translatingLedgerUnavailable(() => Promise.reject(other))).rejects.toBe(other);
    });
});
