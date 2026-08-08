import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { of, type Observable } from "rxjs";
import { describe, expect, it } from "vitest";
import { ResponseEnvelopeInterceptor } from "./response.envelope.interceptor.js";

function contextOf(type: "http" | "rpc" = "http"): ExecutionContext {
    return {
        getType: () => type,
        getHandler: () => undefined,
        getClass: () => undefined,
    } as unknown as ExecutionContext;
}

function handlerOf(payload: unknown): CallHandler {
    return { handle: () => of(payload) };
}

function interceptorOf(skip: boolean): ResponseEnvelopeInterceptor {
    return new ResponseEnvelopeInterceptor(
        { getAllAndOverride: () => (skip ? true : undefined) } as unknown as Reflector,
    );
}

async function firstOf(stream: Observable<unknown>): Promise<unknown> {
    return new Promise((resolve) => stream.subscribe((value) => resolve(value)));
}

describe("응답 봉투", () => {
    it("핸들러의 응답을 성공 봉투로 감싼다", async () => {
        const answered = await firstOf(
            interceptorOf(false).intercept(contextOf(), handlerOf({ job: { id: "job-1" } })),
        );

        expect(answered).toMatchObject({ data: { job: { id: "job-1" } } });
    });

    it("NoEnvelope 를 단 핸들러의 응답은 감싸지 않는다", async () => {
        const payload = { job: { id: "job-1" } };

        const answered = await firstOf(interceptorOf(true).intercept(contextOf(), handlerOf(payload)));

        expect(answered).toBe(payload);
    });

    it("HTTP 가 아닌 응답은 감싸지 않는다", async () => {
        const payload = { event: "chat.execution.updated" };

        const answered = await firstOf(
            interceptorOf(false).intercept(contextOf("rpc"), handlerOf(payload)),
        );

        expect(answered).toBe(payload);
    });
});
