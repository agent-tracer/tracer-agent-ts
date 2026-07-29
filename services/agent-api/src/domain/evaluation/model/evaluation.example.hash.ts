import { createHash } from "node:crypto";

function canonical(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value !== null && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
        return `{${entries.join(",")}}`;
    }
    return JSON.stringify(value);
}

/** 사례의 의미 있는 내용으로 안정적인 중복 판정 해시를 만든다. */
export function computeEvaluationExampleContentHash(input: {
    readonly input: Record<string, unknown>;
    readonly referenceOutput: Record<string, unknown> | null;
    readonly evidence: Record<string, unknown>;
}): string {
    return createHash("sha256").update(canonical(input)).digest("hex");
}
