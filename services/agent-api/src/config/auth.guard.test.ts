import { createHmac } from "node:crypto";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { EXECUTION_SCOPE_TOKEN_PREFIX, MONITOR_USER_HEADER } from "@tracer-agent/platform";
import type { Request } from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MONITOR_SESSION_COOKIE } from "~agent-api/support/session.const.js";
import { AuthGuard } from "./auth.guard.js";

const SECRET = "secret";

function sign(payload: Record<string, unknown>, prefix: string, secret = SECRET): string {
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    return `${prefix}.${payloadB64}.${createHmac("sha256", secret).update(payloadB64).digest("base64url")}`;
}

function authToken(userId: string, purpose: "api" | "session", secret = SECRET): string {
    return sign({ userId, purpose, issuedAt: 0, expiresAt: null }, "mt1", secret);
}

function scopeToken(userId: string, secret = SECRET): string {
    return sign(
        { userId, executionId: "exec-1", issuedAt: 0, expiresAt: Number.MAX_SAFE_INTEGER },
        EXECUTION_SCOPE_TOKEN_PREFIX,
        secret,
    );
}

function requestOf(headers: Record<string, string>): Request {
    return { method: "POST", path: "/api/agent/jobs", headers } as unknown as Request;
}

function contextOf(request: Request): ExecutionContext {
    return {
        getType: () => "http",
        getHandler: () => undefined,
        getClass: () => undefined,
        switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
}

function guardOf(skipGate = false): AuthGuard {
    return new AuthGuard({ getAllAndOverride: () => (skipGate ? true : undefined) } as unknown as Reflector);
}

describe("신원 확정", () => {
    beforeEach(() => {
        process.env["MONITOR_AUTH_TOKEN_SECRET"] = SECRET;
        process.env["MONITOR_AUTH_MODE"] = "token";
    });

    afterEach(() => {
        delete process.env["MONITOR_AUTH_TOKEN_SECRET"];
        delete process.env["MONITOR_AUTH_MODE"];
    });

    it("실행 범위 자격이 자기신고 헤더를 덮는다", () => {
        const request = requestOf({
            authorization: `Bearer ${scopeToken("owner")}`,
            [MONITOR_USER_HEADER]: "impostor",
        });

        expect(guardOf().canActivate(contextOf(request))).toBe(true);
        expect(request.headers[MONITOR_USER_HEADER]).toBe("owner");
    });

    it("실행 범위 토큰 모양의 베어러가 검증에 실패하면 다른 신원으로 되돌아가지 않는다", () => {
        const request = requestOf({
            authorization: `Bearer ${scopeToken("owner", "other")}`,
            cookie: `${MONITOR_SESSION_COOKIE}=${authToken("local", "session")}`,
        });

        expect(() => guardOf().canActivate(contextOf(request))).toThrow(/execution scope token/);
    });

    it("인증을 강제하지 않으면 자기신고 헤더를 그대로 쓴다", () => {
        delete process.env["MONITOR_AUTH_MODE"];
        const request = requestOf({ [MONITOR_USER_HEADER]: "local" });

        expect(guardOf().canActivate(contextOf(request))).toBe(true);
        expect(request.headers[MONITOR_USER_HEADER]).toBe("local");
    });

    it("자격이 없는 요청을 거절한다", () => {
        expect(() => guardOf().canActivate(contextOf(requestOf({}))))
            .toThrow(/valid bearer token or session required/);
    });

    it("세션 자격을 API 베어러로 내밀어도 신원이 되지 않는다", () => {
        const request = requestOf({ authorization: `Bearer ${authToken("local", "session")}` });

        expect(() => guardOf().canActivate(contextOf(request)))
            .toThrow(/valid bearer token or session required/);
    });

    it("검증된 신원을 자기신고 헤더에 확정한다", () => {
        const request = requestOf({ authorization: `Bearer ${authToken("local", "api")}` });

        expect(guardOf().canActivate(contextOf(request))).toBe(true);
        expect(request.headers[MONITOR_USER_HEADER]).toBe("local");
    });

    it("세션 쿠키의 신원도 자기신고 헤더에 확정한다", () => {
        const request = requestOf({ cookie: `${MONITOR_SESSION_COOKIE}=${authToken("local", "session")}` });

        expect(guardOf().canActivate(contextOf(request))).toBe(true);
        expect(request.headers[MONITOR_USER_HEADER]).toBe("local");
    });

    it("자기신고 사용자가 검증된 신원과 다르면 거절한다", () => {
        const request = requestOf({
            authorization: `Bearer ${authToken("local", "api")}`,
            [MONITOR_USER_HEADER]: "other",
        });

        expect(() => guardOf().canActivate(contextOf(request)))
            .toThrow(/self-reported user does not match/);
    });

    it("SkipGate 를 단 창구는 신원 없이 지난다", () => {
        expect(guardOf(true).canActivate(contextOf(requestOf({})))).toBe(true);
    });

    it("HTTP 가 아닌 실행은 신원을 묻지 않는다", () => {
        const context = { ...contextOf(requestOf({})), getType: () => "rpc" } as unknown as ExecutionContext;

        expect(guardOf().canActivate(context)).toBe(true);
    });
});
