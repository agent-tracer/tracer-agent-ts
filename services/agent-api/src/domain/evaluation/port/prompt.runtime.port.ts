export const PROMPT_CLOCK = Symbol("PROMPT_CLOCK");
export interface PromptClockPort { now(): Date }

export const PROMPT_ID_GENERATOR = Symbol("PROMPT_ID_GENERATOR");
export interface PromptIdGeneratorPort { next(prefix: string): string }
