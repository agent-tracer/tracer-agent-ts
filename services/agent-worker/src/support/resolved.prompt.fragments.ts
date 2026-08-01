import {
    computePromptFragmentHash,
    computeResolvedPromptBundleHash,
    computeResolvedPromptHash,
    extractPromptFragmentPlaceholders,
    verifyResolvedPromptBundleHash,
    type PromptFragmentSnapshot,
    type ResolvedPromptBundleHash,
    type ResolvedPromptFragment,
} from "@tracer-agent/llm";
import { renderPromptFragment, type PromptFragmentDefault } from "./prompt.fragment.js";

const PLACEHOLDER = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** 실행 하나가 쓴 조각을 모으며 실행 밖에서 실려 온 조각은 무결성을 검사하고 마지막에 해시를 낸다. */
export class PromptFragmentRunResolver {
    private readonly used: ResolvedPromptFragment[] = [];

    constructor(
        private readonly fragments: readonly ResolvedPromptFragment[] = [],
        private readonly expected?: string | ResolvedPromptBundleHash,
    ) {}

    resolve(
        templateKey: string,
        fragmentSlot: string,
        local: PromptFragmentDefault,
        placeholderValues: Readonly<Record<string, string | number>> = {},
    ): string {
        const resolved = this.fragments.find(
            (entry) => entry.templateKey === templateKey && entry.fragmentSlot === fragmentSlot,
        );
        if (resolved === undefined) return renderPromptFragment(local, placeholderValues);
        if (resolved.definitionKey !== local.definitionKey) {
            throw new Error("prompt-fragment.definition-mismatch");
        }
        if (computePromptFragmentHash(resolved.content) !== resolved.contentHash) {
            throw new Error("prompt-fragment.hash-mismatch");
        }
        if (
            JSON.stringify(extractPromptFragmentPlaceholders(resolved.content))
            !== JSON.stringify([...resolved.placeholders].sort())
        ) {
            throw new Error("prompt-fragment.placeholder-mismatch");
        }
        if (resolved.source === "code-default" && resolved.content !== local.defaultContent) {
            throw new Error("prompt-fragment.code-default-mismatch");
        }
        if (resolved.toolContractVersion !== "1" || resolved.outputSchemaVersion !== "1") {
            throw new Error("prompt-fragment.contract-mismatch");
        }
        if (!this.used.includes(resolved)) this.used.push(resolved);
        return resolved.content.replace(PLACEHOLDER, (_match, name: string) => {
            const value = placeholderValues[name];
            if (value === undefined) throw new Error(`prompt-fragment.placeholder-value-missing:${name}`);
            return String(value);
        });
    }

    finalize(prompt: string): {
        readonly fragmentSnapshots: readonly PromptFragmentSnapshot[];
        readonly resolvedPromptHash: string;
    } {
        const resolvedPromptHash = computeResolvedPromptHash(prompt);
        if (typeof this.expected === "string" && resolvedPromptHash !== this.expected) {
            throw new Error("prompt-fragment.resolved-hash-mismatch");
        }
        return { resolvedPromptHash, fragmentSnapshots: this.snapshots() };
    }

    finalizeBundle(templates: Readonly<Record<string, string>>): {
        readonly fragmentSnapshots: readonly PromptFragmentSnapshot[];
        readonly resolvedPromptHash: string;
        readonly resolvedPromptHashes: readonly {
            readonly templateKey: string;
            readonly contentHash: string;
        }[];
    } {
        const bundle = computeResolvedPromptBundleHash(templates);
        if (typeof this.expected === "object") verifyResolvedPromptBundleHash(templates, this.expected);
        return { ...bundle, fragmentSnapshots: this.snapshots() };
    }

    private snapshots(): readonly PromptFragmentSnapshot[] {
        return this.used.map(
            ({ content: _content, codeName: _codeName, backend: _backend, language: _language, ...snapshot }) =>
                snapshot,
        );
    }
}
