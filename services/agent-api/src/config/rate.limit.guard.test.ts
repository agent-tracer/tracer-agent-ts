import type { ExecutionContext } from "@nestjs/common";
import { HttpStatus } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { DEFAULT_USER_ID, MONITOR_USER_HEADER, TokenBucketLimiter } from "@tracer-agent/platform";
import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { RateLimitGuard } from "./rate.limit.guard.js";

interface Gate {
    readonly guard: RateLimitGuard;
    readonly contextOf: (userId?: string) => ExecutionContext;
    readonly headers: () => Record<string, string>;
}

function gate(options: { readonly capacity: number; readonly skipGate?: boolean }): Gate {
    const headers: Record<string, string> = {};
    const response = {
        setHeader: (name: string, value: string) => {
            headers[name] = value;
        },
    } as unknown as Response;
    const reflector = {
        getAllAndOverride: () => (options.skipGate === true ? true : undefined),
    } as unknown as Reflector;
    const guard = new RateLimitGuard(
        new TokenBucketLimiter({ capacity: options.capacity, refillPerMs: 1 / 1000 }),
        reflector,
    );
    return {
        guard,
        contextOf: (userId?: string) => {
            const request = {
                method: "GET",
                path: "/api/agent/jobs",
                headers: userId === undefined ? {} : { [MONITOR_USER_HEADER]: userId },
            } as unknown as Request;
            return {
                getType: () => "http",
                getHandler: () => undefined,
                getClass: () => undefined,
                switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
            } as unknown as ExecutionContext;
        },
        headers: () => headers,
    };
}

describe("요청 한도", () => {
    it("한도를 넘긴 요청에 429 와 다시 시도할 초를 낸다", () => {
        const { guard, contextOf, headers } = gate({ capacity: 1 });
        guard.canActivate(contextOf("local"));

        expect(() => guard.canActivate(contextOf("local")))
            .toThrow(expect.objectContaining({ status: HttpStatus.TOO_MANY_REQUESTS }) as Error);
        expect(Number(headers()["Retry-After"])).toBeGreaterThanOrEqual(1);
    });

    it("한도는 사용자마다 따로 센다", () => {
        const { guard, contextOf } = gate({ capacity: 1 });
        guard.canActivate(contextOf("local"));

        expect(guard.canActivate(contextOf("other"))).toBe(true);
    });

    it("사용자 헤더가 없으면 기본 사용자로 센다", () => {
        const { guard, contextOf } = gate({ capacity: 1 });
        guard.canActivate(contextOf(DEFAULT_USER_ID));

        expect(() => guard.canActivate(contextOf())).toThrow();
    });

    it("SkipGate 를 단 창구는 세지 않는다", () => {
        const { guard, contextOf } = gate({ capacity: 1, skipGate: true });
        guard.canActivate(contextOf("local"));

        expect(guard.canActivate(contextOf("local"))).toBe(true);
    });
});
