import { InvariantViolationError } from "@tracer-agent/platform";

export const DISCLOSURE_CLASSES = [
    "synthetic",
    "approved-evaluation",
    "production-masked",
    "external-disabled",
] as const;
export type DisclosureClass = (typeof DISCLOSURE_CLASSES)[number];

export const EVALUATOR_KINDS = ["deterministic", "model", "human"] as const;
export type EvaluatorKind = (typeof EVALUATOR_KINDS)[number];

export const PROMPT_BACKENDS = ["python", "claude-sdk"] as const;
export type PromptBackend = (typeof PROMPT_BACKENDS)[number];

export function requireNonEmpty(value: string, code: string): void {
    if (value.trim().length === 0) throw new InvariantViolationError(code);
}

export function requireInteger(value: number, minimum: number, code: string): void {
    if (!Number.isInteger(value) || value < minimum) throw new InvariantViolationError(code);
}

export function requireMember<T extends string>(value: T, allowed: readonly T[], code: string): void {
    if (!allowed.includes(value)) throw new InvariantViolationError(code);
}
