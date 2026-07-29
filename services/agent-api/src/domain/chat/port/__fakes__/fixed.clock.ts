import type { ClockPort } from "~agent-api/domain/chat/port/clock.port.js";

/** 시계 포트의 고정 시각 대역이다. */
export class FixedClock implements ClockPort {
    constructor(private current: Date) {}

    now(): Date {
        return this.current;
    }

    nowMs(): number {
        return this.current.getTime();
    }

    nowIso(): string {
        return this.current.toISOString();
    }

    advance(ms: number): void {
        this.current = new Date(this.current.getTime() + ms);
    }
}
