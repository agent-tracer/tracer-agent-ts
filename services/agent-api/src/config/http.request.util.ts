import type { Request } from "express";

/** 로그의 카디널리티를 줄이려고 매칭된 라우트 패턴을 내며 라우트가 잡히지 않으면 요청 경로를 그대로 낸다. */
export function routePatternOf(request: Request): string {
    const route = (request as { route?: { path?: unknown } }).route;
    if (route !== undefined && typeof route.path === "string") {
        const baseUrl = typeof request.baseUrl === "string" ? request.baseUrl : "";
        return `${baseUrl}${route.path}`;
    }
    return request.path;
}

export function headerValue(raw: string | string[] | undefined): string | undefined {
    return Array.isArray(raw) ? raw[0] : raw;
}
