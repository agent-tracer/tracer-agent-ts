import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    issueExecutionScopeToken,
    looksLikeExecutionScopeToken,
    verifyExecutionScopeToken,
} from "./execution.scope.token.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const GRANT = { userId: "local", executionId: "exec-1", ttlMs: 60_000, now: NOW };

describe("실행 범위 토큰", () => {
    beforeEach(() => {
        process.env["MONITOR_AUTH_TOKEN_SECRET"] = "secret";
    });

    afterEach(() => {
        delete process.env["MONITOR_AUTH_TOKEN_SECRET"];
    });

    it("발급한 자격에서 사용자와 실행을 되읽는다", () => {
        const token = issueExecutionScopeToken(GRANT)!;

        expect(verifyExecutionScopeToken(token, NOW)).toEqual({ userId: "local", executionId: "exec-1" });
    });

    it("수명이 지난 자격을 거절한다", () => {
        const token = issueExecutionScopeToken(GRANT)!;

        expect(verifyExecutionScopeToken(token, new Date(NOW.getTime() + 60_001))).toBeNull();
    });

    it("만료 시각과 같은 순간의 자격을 거절한다", () => {
        const token = issueExecutionScopeToken(GRANT)!;

        expect(verifyExecutionScopeToken(token, new Date(NOW.getTime() + 60_000))).toBeNull();
    });

    it("만료 직전의 자격은 받는다", () => {
        const token = issueExecutionScopeToken(GRANT)!;

        expect(verifyExecutionScopeToken(token, new Date(NOW.getTime() + 59_999))).not.toBeNull();
    });

    it("서명이 다른 자격을 거절한다", () => {
        const token = issueExecutionScopeToken(GRANT)!;
        process.env["MONITOR_AUTH_TOKEN_SECRET"] = "other";

        expect(verifyExecutionScopeToken(token, NOW)).toBeNull();
    });

    it("서명 비밀이 없으면 발급하지 않는다", () => {
        delete process.env["MONITOR_AUTH_TOKEN_SECRET"];

        expect(issueExecutionScopeToken(GRANT)).toBeNull();
    });

    it("접두사만으로 실행 범위 토큰의 모양을 가른다", () => {
        expect(looksLikeExecutionScopeToken("ms1.payload.signature")).toBe(true);
        expect(looksLikeExecutionScopeToken("mt1.payload.signature")).toBe(false);
    });
});
