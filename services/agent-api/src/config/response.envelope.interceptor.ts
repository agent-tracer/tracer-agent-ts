import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { createApiSuccessEnvelope } from "@tracer-agent/platform";
import { NO_ENVELOPE_METADATA_KEY } from "~agent-api/support/no-envelope.decorator.js";

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
    constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        // HTTP 밖의 요청은 봉투로 감싸지 않는다.
        if (context.getType() !== "http") {
            return next.handle();
        }
        const skip = this.reflector.getAllAndOverride<boolean | undefined>(
            NO_ENVELOPE_METADATA_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (skip) {
            return next.handle();
        }
        return next.handle().pipe(map((payload: unknown) => createApiSuccessEnvelope(payload)));
    }
}
