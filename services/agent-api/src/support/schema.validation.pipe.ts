import { BadRequestException, Injectable } from "@nestjs/common";
import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import { createApiErrorEnvelope } from "@tracer-agent/platform";

/** 요청 값을 검사해 성공하면 좁힌 값을, 실패하면 표현 가능한 사유를 내는 스키마의 계약이다. */
export interface RequestSchema<TOutput> {
    safeParse(value: unknown): RequestSchemaResult<TOutput>;
}

/** 스키마 검사 결과이며 실패 사유는 응답 봉투의 details로 실린다. */
export type RequestSchemaResult<TOutput> =
    | { readonly success: true; readonly data: TOutput }
    | { readonly success: false; readonly error: { format(): unknown } };

@Injectable()
export class SchemaValidationPipe<TOutput = unknown> implements PipeTransform<unknown, TOutput> {
    constructor(
        private readonly schema: RequestSchema<TOutput>,
        private readonly code = "validation_error",
        private readonly message = "Invalid request",
    ) {}

    transform(value: unknown, _metadata: ArgumentMetadata): TOutput {
        const parsed = this.schema.safeParse(value);
        if (parsed.success) return parsed.data;
        throw new BadRequestException(
            createApiErrorEnvelope(this.code, this.message, parsed.error.format()),
        );
    }
}
