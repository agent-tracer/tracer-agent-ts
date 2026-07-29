import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { headerValue, routePatternOf } from "~agent-api/config/http.request.util.js";
import {
    createApiErrorEnvelope,
    DomainError,
    errorMessage,
    isApiErrorEnvelope,
    logError,
    logWarn,
    MONITOR_USER_HEADER,
} from "@tracer-agent/platform";

const INTERNAL_SERVER_ERROR_BODY = createApiErrorEnvelope("internal_server_error", "Internal server error");
const STATUS_ERROR_CODES = new Map<number, string>([
    [HttpStatus.BAD_REQUEST, "bad_request"],
    [HttpStatus.UNAUTHORIZED, "unauthorized"],
    [HttpStatus.FORBIDDEN, "forbidden"],
    [HttpStatus.NOT_FOUND, "not_found"],
    [HttpStatus.CONFLICT, "conflict"],
    [HttpStatus.UNPROCESSABLE_ENTITY, "unprocessable_entity"],
]);

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter<unknown> {
    catch(exception: unknown, host: ArgumentsHost): void {
        const httpContext = host.switchToHttp();
        const response = httpContext.getResponse<Response>();
        const request = httpContext.getRequest<Request>();

        if (exception instanceof HttpException) {
            // 프레임워크가 정한 status는 유지하고 본문만 공통 봉투로 맞춘다.
            const status = exception.getStatus();
            this.logRequest(request, status, errorMessage(exception));
            response.status(status).json(normalizeHttpExceptionBody(status, exception.getResponse()));
            return;
        }
        if (exception instanceof DomainError) {
            // 도메인 예외는 선언한 status와 code를 그대로 노출한다.
            this.logRequest(request, exception.httpStatus, exception.message);
            response.status(exception.httpStatus).json(
                createApiErrorEnvelope(exception.code, exception.message, exception.details),
            );
            return;
        }
        if (isZodLikeError(exception)) {
            // 검증 실패는 400으로 고정한다.
            this.logRequest(request, HttpStatus.BAD_REQUEST, "validation_error");
            response.status(HttpStatus.BAD_REQUEST).json(
                createApiErrorEnvelope("validation_error", "Invalid request", exception.format()),
            );
            return;
        }

        const status = getStatusFromError(exception);
        const message = getMessageFromError(exception);
        this.logRequest(request, status, message);
        if (status >= 500) {
            // 서버 오류는 내부 메시지를 숨기고 로그에만 남긴다.
            response.status(status).json(INTERNAL_SERVER_ERROR_BODY);
            return;
        }
        response.status(status).json(createApiErrorEnvelope(statusToErrorCode(status), message));
    }

    private logRequest(request: Request, status: number, error: string): void {
        const fields = {
            method: request.method,
            route: routePatternOf(request),
            status,
            error,
            userId: headerValue(request.headers[MONITOR_USER_HEADER]),
        };
        if (status >= 500) logError({ msg: "http.request.failed", ...fields });
        else logWarn({ msg: "http.request.rejected", ...fields });
    }
}

function normalizeHttpExceptionBody(status: number, body: string | object): unknown {
    // 이미 공통 봉투면 다시 감싸지 않는다.
    if (isApiErrorEnvelope(body)) return body;
    return createApiErrorEnvelope(
        statusToErrorCode(status),
        getMessageFromHttpExceptionBody(body),
        getDetailsFromHttpExceptionBody(body),
    );
}

function getStatusFromError(error: unknown): number {
    if (typeof error === "object" && error !== null) {
        const candidate = (error as { status?: unknown; statusCode?: unknown }).statusCode
            ?? (error as { status?: unknown; statusCode?: unknown }).status;
        if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 400 && candidate < 600) {
            return candidate;
        }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
}

function getMessageFromError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null) {
        const candidate = (error as { message?: unknown }).message;
        if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
    return "Request failed";
}

function getMessageFromHttpExceptionBody(body: string | object): string {
    if (typeof body === "string") return body;
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message) && message.every((item) => typeof item === "string")) {
        return message.join("; ");
    }
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
    return "Request failed";
}

function getDetailsFromHttpExceptionBody(body: string | object): unknown {
    if (typeof body !== "object" || Array.isArray(body)) return undefined;
    const details = (body as { details?: unknown }).details;
    if (details !== undefined) return details;
    const message = (body as { message?: unknown }).message;
    return Array.isArray(message) ? message : undefined;
}

function statusToErrorCode(status: number): string {
    return STATUS_ERROR_CODES.get(status) ?? (status >= 500 ? "internal_server_error" : "request_failed");
}

// zod 값 자체를 import하지 않고 스키마 검증 실패 오류 모양만 구조적으로 식별한다.
function isZodLikeError(error: unknown): error is { readonly issues: unknown; format(): unknown } {
    return error instanceof Error
        && Array.isArray((error as { issues?: unknown }).issues)
        && typeof (error as { format?: unknown }).format === "function";
}
