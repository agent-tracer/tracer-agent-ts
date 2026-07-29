import type { EvaluationClockPort } from "../clock.port.js";

export class FixedEvaluationClock implements EvaluationClockPort {
    constructor(private readonly value: Date) {}

    now(): Date {
        return this.value;
    }
}
