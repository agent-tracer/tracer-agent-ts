import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { Request, Response } from "express";
import { of } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { AccessLogInterceptor } from "./access.log.interceptor.js";

interface Traffic {
    readonly context: ExecutionContext;
    readonly finish: (status: number) => void;
}

function traffic(): Traffic {
    const finished: (() => void)[] = [];
    const response = {
        statusCode: 0,
        once: (event: string, listener: () => void) => {
            if (event === "finish") finished.push(listener);
        },
    } as unknown as Response & { statusCode: number };
    const request = {
        method: "POST",
        path: "/api/agent/jobs",
        headers: { "x-monitor-user": "local" },
    } as unknown as Request;
    return {
        context: {
            getType: () => "http",
            switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
        } as unknown as ExecutionContext,
        finish: (status: number) => {
            response.statusCode = status;
            for (const listener of finished) listener();
        },
    };
}

const handler = { handle: () => of(null) } as unknown as CallHandler;

describe("접근 로그", () => {
    it("응답이 나간 뒤의 상태 코드를 요청당 한 줄로 남긴다", () => {
        const written = vi.spyOn(process.stdout, "write").mockReturnValue(true);
        const { context, finish } = traffic();

        new AccessLogInterceptor().intercept(context, handler);
        expect(written).not.toHaveBeenCalled();
        finish(202);
        const lines = written.mock.calls.map((call) => String(call[0]));
        written.mockRestore();

        expect(lines).toHaveLength(1);
        expect(JSON.parse(lines[0]!)).toMatchObject({
            msg: "http.request.completed",
            method: "POST",
            route: "/api/agent/jobs",
            status: 202,
            userId: "local",
        });
    });
});
