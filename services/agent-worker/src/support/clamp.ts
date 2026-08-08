/** 잘라 낸 값이 다시 검증을 통과하도록 zod 의 `.max()` 와 같은 UTF-16 코드 유닛으로 세되, 원장의 UTF-8 쓰기를 깨는 짝 없는 서로게이트가 남지 않게 쌍 안에서는 한 칸 앞에서 멈춘다. */
export function clampCodeUnits(value: string, max: number): string {
    if (value.length <= max) return value;
    const cut = value.slice(0, max);
    const last = cut.charCodeAt(cut.length - 1);
    return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/** 유한하지 않은 값은 기본값으로 되돌리고 나머지는 정수 범위로 자른다. */
export function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
    if (value === undefined || !Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.trunc(value), min), max);
}
