import type { DisclosureClass } from "./evaluation.types.js";

export interface ExportFilteringPolicy {
    readonly excludeDisabled: boolean;
    readonly disclosureClasses: readonly DisclosureClass[];
    readonly minScore: number | null;
}

export interface ExportManifest {
    readonly datasetId: string;
    readonly datasetRevision: number;
    readonly filteringPolicy: ExportFilteringPolicy;
    readonly entryCount: number;
    readonly contentHash: string;
    readonly exportedAt: string;
    readonly format: "sft-jsonl" | "dpo-jsonl";
}

export interface SftExportEntry {
    readonly messages: readonly { readonly role: "user" | "assistant"; readonly content: string }[];
    readonly metadata: Record<string, string>;
}

export interface DpoExportEntry {
    readonly prompt: string;
    readonly chosen: string;
    readonly rejected: string;
    readonly metadata: Record<string, string>;
}
