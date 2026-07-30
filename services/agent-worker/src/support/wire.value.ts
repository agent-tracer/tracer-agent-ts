/** 경계를 넘어온 값에서 원하는 모양만 꺼내며 어긋나면 대신할 값을 낸다. */
export function wireObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

export function wireArray(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
}

/** 봉투를 벗긴 본문에서 배열 칸 하나를 꺼낸다. */
export function wireItems(value: unknown, field = "items"): readonly Record<string, unknown>[] {
    return wireArray(wireObject(value)[field]).map(wireObject);
}

export function wireText(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

export function wireNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

export function wireTexts(value: unknown): readonly string[] {
    return wireArray(value).filter((entry): entry is string => typeof entry === "string");
}

/** 시각은 ISO 문자열로 건네지므로 값이 없으면 기점으로 대신한다. */
export function wireDate(value: unknown): Date {
    const text = wireText(value);
    if (text === null) return new Date(0);
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}
