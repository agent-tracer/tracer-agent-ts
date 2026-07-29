/** 유한하지 않은 값은 기본값으로 되돌리고 나머지는 정수 범위로 자른다. */
export function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
    if (value === undefined || !Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.trunc(value), min), max);
}
