import type {
    ExperimentClockPort,
    ExperimentDispatcherPort,
    ExperimentIdGeneratorPort,
    ExperimentRandomPort,
} from "../experiment.support.port.js";

export class FixedExperimentClock implements ExperimentClockPort {
    constructor(private readonly value: Date) {}
    now(): Date {
        return this.value;
    }
    nowMs(): number {
        return this.value.getTime();
    }
    nowIso(): string {
        return this.value.toISOString();
    }
}

export class SequentialExperimentIdGenerator implements ExperimentIdGeneratorPort {
    private sequence = 0;
    next(scope: Parameters<ExperimentIdGeneratorPort["next"]>[0]): string {
        this.sequence += 1;
        return `${scope}-${this.sequence}`;
    }
}

export class RecordingExperimentDispatcher implements ExperimentDispatcherPort {
    readonly dispatched: { readonly experimentId: string; readonly userId: string }[] = [];
    constructor(private readonly workflowId = "workflow-1") {}

    async dispatch(input: { readonly experimentId: string; readonly userId: string }) {
        this.dispatched.push(input);
        return { workflowId: this.workflowId };
    }

    async cancel(): Promise<"cancelled" | "absent"> {
        return "cancelled";
    }
}

export class FirstChoiceRandom implements ExperimentRandomPort {
    number(): number {
        return 0;
    }
    boolean(): boolean {
        return false;
    }
}
