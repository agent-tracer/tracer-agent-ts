import type { PromptFragmentManifestEntry, ResolvedPromptFragment } from "@tracer-agent/llm";

export interface ChatPromptFragmentSnapshotPort {
    initialize(
        manifest: readonly PromptFragmentManifestEntry[],
        resolved: readonly ResolvedPromptFragment[],
    ): void;
    read(): readonly ResolvedPromptFragment[];
    validate(fragments: readonly ResolvedPromptFragment[]): void;
}
