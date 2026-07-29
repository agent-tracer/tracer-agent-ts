import { EvaluationInputMissingFieldError } from "./evaluation.error.js";

/** example.input에서 필수 문자열 필드를 읽으며, 없거나 비어 있으면 재시도로 풀리지 않는 실패를 던진다. */
export function requireStringField(input: Record<string, unknown>, field: string): string {
    const value = input[field];
    if (typeof value !== "string" || value.trim().length === 0) throw new EvaluationInputMissingFieldError(field);
    return value;
}

/** example.input에서 선택 문자열 필드를 읽는다. */
export function readOptionalStringField(input: Record<string, unknown>, field: string): string | undefined {
    const value = input[field];
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

/** example.input에서 선택 정수 필드를 읽는다. */
export function readOptionalIntField(input: Record<string, unknown>, field: string): number | undefined {
    const value = input[field];
    return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}
