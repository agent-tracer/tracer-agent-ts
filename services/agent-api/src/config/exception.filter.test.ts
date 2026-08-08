import type { ArgumentsHost } from "@nestjs/common";
import { HttpException, HttpStatus, NotFoundException } from "@nestjs/common";
import { createApiErrorEnvelope, InvariantViolationError } from "@tracer-agent/platform";
import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { GlobalExceptionFilter } from "./exception.filter.js";

interface Answered {
    readonly host: ArgumentsHost;
    status(): number;
    body(): Record<string, unknown>;
}

function answered(): Answered {
    let status = 0;
    let body: Record<string, unknown> = {};
    const response = {
        status: (code: number) => {
            status = code;
            return response;
        },
        json: (payload: Record<string, unknown>) => {
            body = payload;
            return response;
        },
    } as unknown as Response;
    const request = { method: "POST", path: "/api/agent/jobs", headers: {} } as unknown as Request;
    return {
        host: {
            switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
        } as unknown as ArgumentsHost,
        status: () => status,
        body: () => body,
    };
}

function caught(exception: unknown): Answered {
    const answer = answered();
    new GlobalExceptionFilter().catch(exception, answer.host);
    return answer;
}

describe("예외 봉투", () => {
    it("서버 오류의 내부 메시지를 응답 본문에 싣지 않는다", () => {
        const answer = caught(new Error("password=hunter2 로 접속에 실패했다"));

        expect(answer.status()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(JSON.stringify(answer.body())).not.toContain("hunter2");
        expect(answer.body()).toEqual(createApiErrorEnvelope("internal_server_error", "Internal server error"));
    });

    it("도메인 거절의 상태와 코드를 그대로 낸다", () => {
        const answer = caught(new InvariantViolationError("job.not-cancelable"));

        expect(answer.status()).toBe(HttpStatus.CONFLICT);
        expect(answer.body()).toMatchObject({ error: { code: "job.not-cancelable" } });
    });

    it("검증 실패를 400 과 validation_error 로 낸다", () => {
        const zodLike = Object.assign(new Error("invalid"), {
            issues: [{ path: ["kind"] }],
            format: () => ({ kind: { _errors: ["required"] } }),
        });

        const answer = caught(zodLike);

        expect(answer.status()).toBe(HttpStatus.BAD_REQUEST);
        expect(answer.body()).toMatchObject({ error: { code: "validation_error" } });
    });

    it("프레임워크 예외의 상태를 유지하고 본문만 공통 봉투로 맞춘다", () => {
        const answer = caught(new NotFoundException("Job execution not found"));

        expect(answer.status()).toBe(HttpStatus.NOT_FOUND);
        expect(answer.body()).toMatchObject({
            error: { code: "not_found", message: "Job execution not found" },
        });
    });

    it("이미 봉투인 프레임워크 예외를 다시 감싸지 않는다", () => {
        const envelope = createApiErrorEnvelope("rate_limited", "API rate limit exceeded");

        const answer = caught(new HttpException(envelope, HttpStatus.TOO_MANY_REQUESTS));

        expect(answer.status()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(answer.body()).toEqual(envelope);
    });

    it("상태를 실은 오류는 그 상태로 내고 4xx 메시지는 남긴다", () => {
        const answer = caught(Object.assign(new Error("upstream said no"), { status: 502 }));

        expect(answer.status()).toBe(502);
        expect(JSON.stringify(answer.body())).not.toContain("upstream said no");
    });
});
