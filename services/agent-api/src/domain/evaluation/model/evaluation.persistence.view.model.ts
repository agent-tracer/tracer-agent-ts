export interface EvaluationExecutionView {
    readonly id: string;
    readonly exampleId: string;
    readonly variantId: string;
    readonly status: "pending" | "running" | "succeeded" | "failed" | "cancelled" | "not_evaluable" | "budget_skipped";
    readonly output: Record<string, unknown> | null;
}

export interface EvaluationScoreView {
    readonly score: number | null;
}

export interface EvaluationExperimentView {
    readonly id: string;
    readonly datasetId: string;
    readonly datasetRevision: number;
    readonly status: string;
}
