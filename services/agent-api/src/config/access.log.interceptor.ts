import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Observable } from "rxjs";
import { headerValue, routePatternOf } from "~agent-api/config/http.request.util.js";
import { logInfo, MONITOR_USER_HEADER } from "@tracer-agent/platform";

/** 요청당 한 줄만 남겨 응답이 실제로 나간 뒤의 최종 상태 코드를 기록한다. */
@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== "http") return next.handle();
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();
        const startedAt = Date.now();
        response.once("finish", () => {
            logInfo({
                msg: "http.request.completed",
                method: request.method,
                route: routePatternOf(request),
                status: response.statusCode,
                durationMs: Date.now() - startedAt,
                userId: headerValue(request.headers[MONITOR_USER_HEADER]),
            });
        });
        return next.handle();
    }
}
