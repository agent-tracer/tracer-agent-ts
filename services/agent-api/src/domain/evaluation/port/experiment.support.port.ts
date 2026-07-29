import type { IClock } from "@tracer-agent/platform";

export const EXPERIMENT_CLOCK = Symbol("ExperimentClock");
export const EXPERIMENT_ID_GENERATOR = Symbol("ExperimentIdGenerator");
export const EXPERIMENT_RANDOM = Symbol("ExperimentRandom");
export const EXPERIMENT_DISPATCHER = Symbol("ExperimentDispatcher");

export type ExperimentClockPort = IClock;

export interface ExperimentIdGeneratorPort {
    next(scope: "experiment" | "variant" | "review" | "review_revision"): string;
}

export interface ExperimentRandomPort {
    number(): number;
    boolean(): boolean;
}

export interface ExperimentDispatcherPort {
    dispatch(input: { readonly experimentId: string; readonly userId: string }): Promise<{ readonly workflowId: string }>;
    cancel(experimentId: string): Promise<"cancelled" | "absent">;
}
