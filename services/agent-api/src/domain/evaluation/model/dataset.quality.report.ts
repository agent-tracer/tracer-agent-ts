import type { DisclosureClass } from "./evaluation.types.js";

export interface DatasetQualityReport {
    readonly datasetId: string;
    readonly revision: number;
    readonly totalExamples: number;
    readonly enabledExamples: number;
    readonly duplicateRate: number;
    readonly labelDistribution: Record<string, number>;
    readonly disclosureDistribution: Partial<Record<DisclosureClass, number>>;
    readonly contentHashCollisions: number;
    readonly warnings: readonly string[];
}
