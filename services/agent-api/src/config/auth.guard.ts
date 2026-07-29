import { ForbiddenException, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import {
    isAuthEnforced,
    logWarn,
    looksLikeExecutionScopeToken,
    MONITOR_USER_HEADER,
    parseCookie,
    verifyAuthToken,
    verifyExecutionScopeToken,
} from "@tracer-agent/platform";
import { headerValue, routePatternOf } from "~agent-api/config/http.request.util.js";
import { MONITOR_SESSION_COOKIE } from "~agent-api/support/session.const.js";
import { SKIP_GATE_METADATA_KEY } from "~agent-api/support/skip-gate.decorator.js";

/** 데몬은 Bearer 토큰(purpose=api), 웹은 세션 쿠키(purpose=session), 에이전트 실행은 실행 범위 토큰으로 신원을 검증하고 자기신고 헤더를 검증된 값으로 확정한다. */
@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        if (context.getType() !== "http") return true;
        if (this.reflector.getAllAndOverride<boolean | undefined>(SKIP_GATE_METADATA_KEY, [context.getHandler(), context.getClass()])) {
            return true;
        }
        const request = context.switchToHttp().getRequest<Request>();
        // 실행 범위 토큰을 들고 온 요청은 인증 강제 여부와 무관하게 그 토큰이 자기신고 헤더를 이긴다.
        const scopedUserId = this.resolveExecutionScope(request);
        if (scopedUserId !== null) {
            request.headers[MONITOR_USER_HEADER] = scopedUserId;
            return true;
        }
        if (!isAuthEnforced()) return true;

        const userId = resolvePrincipal(request);
        if (userId === null) {
            logWarn({ msg: "auth.request.rejected", method: request.method, route: routePatternOf(request) });
            throw new UnauthorizedException("valid bearer token or session required");
        }

        const claimed = headerValue(request.headers[MONITOR_USER_HEADER]);
        if (claimed !== undefined && claimed.trim().length > 0 && claimed.trim() !== userId) {
            logWarn({
                msg: "auth.identity.mismatched",
                method: request.method,
                route: routePatternOf(request),
                userId,
                claimedUserId: claimed.trim(),
            });
            throw new ForbiddenException("self-reported user does not match the authenticated identity");
        }
        request.headers[MONITOR_USER_HEADER] = userId;
        return true;
    }

    /** 실행 범위 토큰 모양의 베어러는 검증에 실패해도 다른 신원으로 되돌아가지 못하게 여기서 끊는다. */
    private resolveExecutionScope(request: Request): string | null {
        const bearer = bearerToken(request);
        if (bearer === null || !looksLikeExecutionScopeToken(bearer)) return null;
        const scope = verifyExecutionScopeToken(bearer);
        if (scope === null) {
            logWarn({ msg: "auth.execution_scope.rejected", method: request.method, route: routePatternOf(request) });
            throw new UnauthorizedException("execution scope token is invalid or expired");
        }
        return scope.userId;
    }
}

function bearerToken(request: Request): string | null {
    const raw = headerValue(request.headers["authorization"]);
    return raw !== undefined && raw.startsWith("Bearer ") ? raw.slice("Bearer ".length).trim() : null;
}

function resolvePrincipal(request: Request): string | null {
    const bearer = bearerToken(request);
    if (bearer !== null) {
        const userId = verifyAuthToken(bearer, "api");
        if (userId !== null) return userId;
    }
    const cookie = parseCookie(request.headers["cookie"], MONITOR_SESSION_COOKIE);
    return cookie !== null ? verifyAuthToken(cookie, "session") : null;
}
