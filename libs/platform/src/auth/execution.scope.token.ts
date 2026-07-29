import { createHmac, timingSafeEqual } from "node:crypto";

/** 하나의 실행이 자기 사용자 범위 안에서만 API를 부르도록 실행에 매인 자격이며, 저장소 없이 서명만으로 검증하고 발급 시점에 수명을 못박는다. */
export interface ExecutionScope {
    readonly userId: string;
    readonly executionId: string;
}

interface ScopeTokenPayload extends ExecutionScope {
    readonly issuedAt: number;
    readonly expiresAt: number;
}

/** 인증 베어러와 섞이지 않도록 실행 범위 토큰만의 접두사를 둔다. */
export const EXECUTION_SCOPE_TOKEN_PREFIX = "ms1";

function resolveSecret(): string | null {
    const secret = process.env["MONITOR_AUTH_TOKEN_SECRET"];
    return secret !== undefined && secret.trim().length > 0 ? secret.trim() : null;
}

function sign(payloadB64: string, secret: string): string {
    return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export interface IssueExecutionScopeTokenInput extends ExecutionScope {
    readonly ttlMs: number;
    readonly now: Date;
}

/** 서명 비밀이 없으면 자격을 만들 수 없으므로 발급하지 않고 비운다. */
export function issueExecutionScopeToken(input: IssueExecutionScopeTokenInput): string | null {
    const secret = resolveSecret();
    if (secret === null) return null;
    const issuedAt = input.now.getTime();
    const payload: ScopeTokenPayload = {
        userId: input.userId,
        executionId: input.executionId,
        issuedAt,
        expiresAt: issuedAt + input.ttlMs,
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    return `${EXECUTION_SCOPE_TOKEN_PREFIX}.${payloadB64}.${sign(payloadB64, secret)}`;
}

/** 베어러가 실행 범위 토큰의 모양인지만 보며, 모양이 맞으면 검증에 실패해도 인증으로 되돌리지 않는다. */
export function looksLikeExecutionScopeToken(candidate: string): boolean {
    return candidate.startsWith(`${EXECUTION_SCOPE_TOKEN_PREFIX}.`);
}

/** 서명과 수명이 모두 맞을 때만 실행 범위를 내주므로, 이 값이 자기신고 헤더를 이긴다. */
export function verifyExecutionScopeToken(token: string, now: Date = new Date()): ExecutionScope | null {
    const secret = resolveSecret();
    if (secret === null) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [prefix, payloadB64, signature] = parts;
    if (prefix !== EXECUTION_SCOPE_TOKEN_PREFIX || !payloadB64 || !signature) return null;

    const expected = Buffer.from(sign(payloadB64, secret), "utf8");
    const actual = Buffer.from(signature, "utf8");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    let payload: ScopeTokenPayload;
    try {
        payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as ScopeTokenPayload;
    } catch {
        return null;
    }
    if (typeof payload.userId !== "string" || payload.userId.length === 0) return null;
    if (typeof payload.executionId !== "string" || payload.executionId.length === 0) return null;
    if (typeof payload.expiresAt !== "number" || payload.expiresAt < now.getTime()) return null;
    return { userId: payload.userId, executionId: payload.executionId };
}
