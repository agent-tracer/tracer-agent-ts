import type { Experiment, ExperimentVariant } from "./experiment.model.js";

export interface ExperimentExampleSummary {
    readonly id: string;
}

export interface ExperimentPreview {
    readonly exampleCount: number;
    readonly variantCount: number;
    readonly repetitions: number;
    readonly executionCount: number;
    readonly maxBudgetUsd: number;
    readonly fingerprint: string;
}

export interface ExperimentStartConfirmation {
    readonly executionCount: number;
    readonly maxBudgetUsd: number;
    readonly fingerprint: string;
}

export function buildExperimentPreview(
    experiment: Experiment,
    examples: readonly ExperimentExampleSummary[],
    variants: readonly ExperimentVariant[],
): ExperimentPreview {
    const executionCount = examples.length * variants.length * experiment.repetitions;
    const fingerprint = [
        experiment.id,
        experiment.datasetRevision,
        ...examples.map((row) => row.id).sort(),
        ...variants.map((row) => row.id).sort(),
    ].join(":");
    return {
        exampleCount: examples.length,
        variantCount: variants.length,
        repetitions: experiment.repetitions,
        executionCount,
        maxBudgetUsd: experiment.maxBudgetUsd,
        fingerprint,
    };
}

export function confirmsPreview(preview: ExperimentPreview, value: ExperimentStartConfirmation): boolean {
    return preview.executionCount === value.executionCount
        && preview.maxBudgetUsd === value.maxBudgetUsd
        && preview.fingerprint === value.fingerprint;
}
