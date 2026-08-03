import { createHash } from "node:crypto";
import { JOB_KIND, type JobKind } from "~agent-api/domain/job/model/job.const.js";

/** 같은 멱등키의 두 접수가 같은 입력인지 구분하는 칸이며 종류마다 이 순서로 적는다. */
export const JOB_IDEMPOTENCY_KEYS = {
    [JOB_KIND.titleSuggestion]: ["taskId"],
    [JOB_KIND.recipeScan]: ["taskId", "userPrompt", "language", "trigger"],
    [JOB_KIND.taskCleanup]: ["filters.maxSuggestions"],
    [JOB_KIND.ruleGeneration]: ["taskId", "anchorEventId", "focus", "maxRules", "intent"],
} as const satisfies Record<JobKind, readonly string[]>;

/** 두 구현체가 같은 바이트를 먹도록 그 종류가 정한 칸만 정해진 순서로 적는다. */
export function canonicalJobInput(kind: JobKind, input: Record<string, unknown>): string {
    const canonical: Record<string, unknown> = {};
    for (const key of JOB_IDEMPOTENCY_KEYS[kind]) canonical[key] = readPath(input, key) ?? null;
    return JSON.stringify(canonical);
}

/** 접수가 다듬은 도메인 입력의 안정 해시이며 멱등 판정은 이 값만 본다. */
export function hashJobInput(kind: JobKind, input: Record<string, unknown>): string {
    return createHash("sha256").update(canonicalJobInput(kind, input), "utf8").digest("hex");
}

function readPath(input: Record<string, unknown>, key: string): unknown {
    return key.split(".").reduce<unknown>((value, part) => {
        if (typeof value !== "object" || value === null) return undefined;
        return (value as Record<string, unknown>)[part];
    }, input);
}
