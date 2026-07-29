export const EVALUATION_CLOCK = Symbol("EvaluationClock");

export interface EvaluationClockPort {
    now(): Date;
}
