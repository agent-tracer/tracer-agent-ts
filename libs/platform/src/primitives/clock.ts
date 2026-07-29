export interface IClock {
    nowMs(): number;
    nowIso(): string;
    now(): Date;
}

export class SystemClock implements IClock {
    nowMs(): number {
        return Date.now();
    }

    nowIso(): string {
        return new Date().toISOString();
    }

    now(): Date {
        return new Date();
    }
}
