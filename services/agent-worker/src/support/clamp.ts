import { clampCodePoints } from "@tracer-agent/llm";

/** 유한하지 않은 값은 기본값으로 되돌리고 나머지는 정수 범위로 자른다. */
export function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
    if (value === undefined || !Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.trunc(value), min), max);
}

/** 계약이 정한 글자 단위는 코드포인트이므로 자르는 자리도 그 단위를 쓴다. */
export function clampText(value: string, max: number): string {
    return clampCodePoints(value, max);
}
