import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAuthEnforced, verifyAuthToken, type AuthTokenPurpose } from "./auth.token.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const SECRET = "secret";

/** 발급은 다른 표면이 하므로 이 테스트가 같은 와이어 모양으로 자격을 만든다. */
function mintAuthToken(options: {
    readonly userId?: string;
    readonly purpose: AuthTokenPurpose;
    readonly expiresAt?: number | null;
    readonly secret?: string;
}): string {
    const payload = {
        userId: options.userId ?? "local",
        purpose: options.purpose,
        issuedAt: NOW.getTime(),
        expiresAt: options.expiresAt === undefined ? NOW.getTime() + 60_000 : options.expiresAt,
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = createHmac("sha256", options.secret ?? SECRET).update(payloadB64).digest("base64url");
    return `mt1.${payloadB64}.${signature}`;
}

describe("인증 자격", () => {
    beforeEach(() => {
        process.env["MONITOR_AUTH_TOKEN_SECRET"] = SECRET;
    });

    afterEach(() => {
        delete process.env["MONITOR_AUTH_TOKEN_SECRET"];
        delete process.env["MONITOR_AUTH_MODE"];
    });

    it("발급한 자격에서 사용자를 되읽는다", () => {
        expect(verifyAuthToken(mintAuthToken({ purpose: "api" }), "api", NOW)).toBe("local");
    });

    it("세션 자격을 API 자격으로 검증하지 않는다", () => {
        expect(verifyAuthToken(mintAuthToken({ purpose: "session" }), "api", NOW)).toBeNull();
    });

    it("API 자격을 세션 자격으로 검증하지 않는다", () => {
        expect(verifyAuthToken(mintAuthToken({ purpose: "api" }), "session", NOW)).toBeNull();
    });

    it("수명이 지난 자격을 거절한다", () => {
        const token = mintAuthToken({ purpose: "api", expiresAt: NOW.getTime() });

        expect(verifyAuthToken(token, "api", new Date(NOW.getTime() + 1))).toBeNull();
    });

    it("수명을 적지 않은 자격은 만료로 거절하지 않는다", () => {
        const token = mintAuthToken({ purpose: "api", expiresAt: null });

        expect(verifyAuthToken(token, "api", new Date(NOW.getTime() + 10_000_000))).toBe("local");
    });

    it("서명이 다른 자격을 거절한다", () => {
        expect(verifyAuthToken(mintAuthToken({ purpose: "api", secret: "other" }), "api", NOW)).toBeNull();
    });

    it("본문만 바꿔치운 자격을 거절한다", () => {
        const [prefix, , signature] = mintAuthToken({ purpose: "api" }).split(".");
        const forged = Buffer.from(
            JSON.stringify({ userId: "victim", purpose: "api", issuedAt: 0, expiresAt: null }),
            "utf8",
        ).toString("base64url");

        expect(verifyAuthToken(`${prefix}.${forged}.${signature}`, "api", NOW)).toBeNull();
    });

    it("실행 범위 토큰의 접두사를 단 자격을 거절한다", () => {
        const token = mintAuthToken({ purpose: "api" }).replace("mt1.", "ms1.");

        expect(verifyAuthToken(token, "api", NOW)).toBeNull();
    });

    it("사용자가 비어 있는 자격을 거절한다", () => {
        expect(verifyAuthToken(mintAuthToken({ userId: "", purpose: "api" }), "api", NOW)).toBeNull();
    });

    it("서명 비밀이 없으면 어떤 자격도 받아들이지 않는다", () => {
        const token = mintAuthToken({ purpose: "api" });
        delete process.env["MONITOR_AUTH_TOKEN_SECRET"];

        expect(verifyAuthToken(token, "api", NOW)).toBeNull();
    });
});

describe("인증 강제", () => {
    afterEach(() => {
        delete process.env["MONITOR_AUTH_TOKEN_SECRET"];
        delete process.env["MONITOR_AUTH_MODE"];
    });

    it("token 모드와 서명 비밀이 모두 있을 때만 켜진다", () => {
        process.env["MONITOR_AUTH_MODE"] = "token";
        process.env["MONITOR_AUTH_TOKEN_SECRET"] = SECRET;

        expect(isAuthEnforced()).toBe(true);
    });

    it("서명 비밀이 없으면 token 모드여도 켜지지 않는다", () => {
        process.env["MONITOR_AUTH_MODE"] = "token";

        expect(isAuthEnforced()).toBe(false);
    });

    it("token 모드가 아니면 서명 비밀이 있어도 켜지지 않는다", () => {
        process.env["MONITOR_AUTH_TOKEN_SECRET"] = SECRET;

        expect(isAuthEnforced()).toBe(false);
    });

    it("공백뿐인 서명 비밀은 없는 것으로 본다", () => {
        process.env["MONITOR_AUTH_MODE"] = "token";
        process.env["MONITOR_AUTH_TOKEN_SECRET"] = "   ";

        expect(isAuthEnforced()).toBe(false);
    });
});
