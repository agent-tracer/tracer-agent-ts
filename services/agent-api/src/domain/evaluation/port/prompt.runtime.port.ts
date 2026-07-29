export const PROMPT_CLOCK = Symbol("PROMPT_CLOCK");
export interface PromptClockPort { now(): Date }

export const PROMPT_ID_GENERATOR = Symbol("PROMPT_ID_GENERATOR");
export interface PromptIdGeneratorPort { next(prefix: string): string }

export interface PromotionGateResult {
    readonly passed: boolean;
    readonly policyVersion: string;
    readonly reasons: readonly string[];
    readonly evidence: Readonly<Record<string, unknown>>;
}
export const PROMPT_PROMOTION_GATE = Symbol("PROMPT_PROMOTION_GATE");
export interface PromptPromotionGatePort {
    evaluate(input: { userId: string; experimentId: string; promptVersionId: string }): Promise<PromotionGateResult>;
}
