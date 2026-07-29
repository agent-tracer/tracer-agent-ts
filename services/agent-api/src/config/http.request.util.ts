import type { Request } from "express";

/** 아이디가 섞인 원시 URL 대신 매칭된 라우트 패턴을 돌려줘 로그의 카디널리티를 막는다. */
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
