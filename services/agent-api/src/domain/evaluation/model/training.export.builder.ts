import { createHash } from "node:crypto";
import type { EvaluationExample } from "./dataset.model.js";
import type {
    DpoExportEntry,
    ExportFilteringPolicy,
    SftExportEntry,
} from "./training.export.model.js";
import type { EvaluationExecutionView, EvaluationScoreView } from "./evaluation.persistence.view.model.js";

export function acceptsExample(example: EvaluationExample, policy: ExportFilteringPolicy): boolean {
    return (!policy.excludeDisabled || example.enabled)
        && policy.disclosureClasses.includes(example.disclosureClass);
}

export function minimumScore(scores: readonly EvaluationScoreView[]): number | null {
    const values = scores.flatMap((item) => item.score === null ? [] : [item.score]);
    return values.length === 0 ? null : Math.min(...values);
}

export function buildSftEntry(
    example: EvaluationExample,
    execution: EvaluationExecutionView,
): SftExportEntry {
    return {
        messages: [
            { role: "user", content: JSON.stringify(example.input) },
            { role: "assistant", content: JSON.stringify(execution.output) },
        ],
        metadata: {
            datasetId: example.datasetId,
            exampleId: example.id,
            executionId: execution.id,
            promptVersion: "unknown",
        },
    };
}

export function buildDpoEntry(
    example: EvaluationExample,
    chosen: EvaluationExecutionView,
    rejected: EvaluationExecutionView,
): DpoExportEntry {
    return {
        prompt: JSON.stringify(example.input),
        chosen: JSON.stringify(chosen.output),
        rejected: JSON.stringify(rejected.output),
        metadata: {
            datasetId: example.datasetId,
            exampleId: example.id,
            executionIdChosen: chosen.id,
            executionIdRejected: rejected.id,
        },
    };
}

export function hashExport(entries: readonly unknown[]): string {
    return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}
