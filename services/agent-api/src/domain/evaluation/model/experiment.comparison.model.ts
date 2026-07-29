import type { EvaluationScore, ExperimentExecution, ExperimentVariant } from "./experiment.model.js";

export interface VariantComparison {
    readonly variantId: string;
    readonly name: string;
    readonly succeeded: number;
    readonly meanScore: number | null;
    readonly totalCostUsd: number;
}

export function compareExperiment(
    variants: readonly ExperimentVariant[],
    executions: readonly ExperimentExecution[],
    scores: readonly EvaluationScore[],
): readonly VariantComparison[] {
    return variants.map((variant) => {
        const completed = executions.filter((row) => row.variantId === variant.id && row.status === "succeeded");
        const executionIds = new Set(completed.map((row) => row.id));
        const values = scores.filter((row) => executionIds.has(row.executionId)).map((row) => row.score);
        return {
            variantId: variant.id,
            name: variant.name,
            succeeded: completed.length,
            meanScore: values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length,
            totalCostUsd: completed.reduce((sum, row) => sum + row.costUsd, 0),
        };
    });
}
