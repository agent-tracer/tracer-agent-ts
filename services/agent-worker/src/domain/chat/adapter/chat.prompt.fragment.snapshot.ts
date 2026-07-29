import {
    computePromptFragmentHash,
    extractPromptFragmentPlaceholders,
    type PromptFragmentManifestEntry,
    type ResolvedPromptFragment,
} from "@tracer-agent/llm";
import type { ChatPromptFragmentSnapshotPort } from "~agent-worker/domain/chat/port/chat.prompt.fragment.snapshot.port.js";

export class ChatPromptFragmentSnapshot implements ChatPromptFragmentSnapshotPort {
    private snapshot: readonly ResolvedPromptFragment[] | null = null;

    initialize(
        manifest: readonly PromptFragmentManifestEntry[],
        resolved: readonly ResolvedPromptFragment[],
    ): void {
        if (this.snapshot !== null) throw new Error("chat.prompt-fragment.snapshot-already-initialized");
        const expected = manifest
            .flatMap((entry) =>
                entry.bindings.map(
                    (binding) => `${binding.templateKey}/${binding.fragmentSlot}/${entry.definitionKey}`,
                ),
            )
            .sort();
        const actual = resolved.map(fragmentIdentity).sort();
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            throw new Error("chat.prompt-fragment.incomplete-resolution");
        }
        for (const fragment of resolved) {
            if (computePromptFragmentHash(fragment.content) !== fragment.contentHash) {
                throw new Error("chat.prompt-fragment.hash-mismatch");
            }
            const local = manifest.find((entry) => entry.definitionKey === fragment.definitionKey);
            if (
                local === undefined
                || JSON.stringify(extractPromptFragmentPlaceholders(fragment.content))
                    !== JSON.stringify(fragment.placeholders)
                || JSON.stringify(extractPromptFragmentPlaceholders(local.defaultContent))
                    !== JSON.stringify(fragment.placeholders)
            ) {
                throw new Error("chat.prompt-fragment.placeholder-mismatch");
            }
            if (
                fragment.toolContractVersion !== local.toolContractVersion
                || fragment.outputSchemaVersion !== local.outputSchemaVersion
            ) {
                throw new Error("chat.prompt-fragment.contract-mismatch");
            }
        }
        this.snapshot = Object.freeze(resolved.map((fragment) => Object.freeze({ ...fragment })));
    }

    /** 초기화되지 않은 상태는 코드 기본값을 쓴다는 뜻이므로 빈 배열로 낸다. */
    read(): readonly ResolvedPromptFragment[] {
        return this.snapshot ?? [];
    }

    validate(fragments: readonly ResolvedPromptFragment[]): void {
        const baseline = this.read();
        const expected = baseline.map(fragmentIdentity).sort();
        const actual = fragments.map(fragmentIdentity).sort();
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            throw new Error("chat.prompt-fragment.incomplete-run-snapshot");
        }
        for (const fragment of fragments) {
            const contract = baseline.find(
                (candidate) => fragmentIdentity(candidate) === fragmentIdentity(fragment),
            );
            if (contract === undefined || computePromptFragmentHash(fragment.content) !== fragment.contentHash) {
                throw new Error("chat.prompt-fragment.run-hash-mismatch");
            }
            if (
                JSON.stringify(extractPromptFragmentPlaceholders(fragment.content))
                    !== JSON.stringify(fragment.placeholders)
                || JSON.stringify(fragment.placeholders) !== JSON.stringify(contract.placeholders)
                || fragment.toolContractVersion !== contract.toolContractVersion
                || fragment.outputSchemaVersion !== contract.outputSchemaVersion
            ) {
                throw new Error("chat.prompt-fragment.run-contract-mismatch");
            }
        }
    }
}

function fragmentIdentity(fragment: ResolvedPromptFragment): string {
    return `${fragment.templateKey}/${fragment.fragmentSlot}/${fragment.definitionKey}`;
}
