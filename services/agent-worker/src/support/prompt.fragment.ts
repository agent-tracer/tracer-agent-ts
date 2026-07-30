import {
    computePromptFragmentHash, extractPromptFragmentPlaceholders, type PromptFragmentManifestEntry,
} from "@tracer-agent/llm";

export interface PromptFragmentDefault {
    readonly codeName: `SDK_${string}`;
    readonly definitionKey: `sdk.${string}`;
    readonly defaultVersion: `v${number}`;
    readonly defaultContent: string;
    readonly contentHash: string;
    readonly placeholders: readonly string[];
}

export interface PromptFragmentBindingSpec {
    readonly templateKey: `sdk.${string}`;
    readonly fragmentSlot: string;
    readonly fragment: PromptFragmentDefault;
}

const PLACEHOLDER = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export function definePromptFragment(
    fragment: Omit<PromptFragmentDefault, "contentHash" | "placeholders">,
): PromptFragmentDefault {
    return {
        ...fragment,
        contentHash: computePromptFragmentHash(fragment.defaultContent),
        placeholders: extractPromptFragmentPlaceholders(fragment.defaultContent),
    };
}

export function renderPromptFragment(
    fragment: PromptFragmentDefault,
    placeholders: Readonly<Record<string, string | number>>,
): string {
    return fragment.defaultContent.replace(PLACEHOLDER, (_match, name: string) => {
        const value = placeholders[name];
        if (value === undefined) throw new Error(`unknown prompt placeholder: ${name}`);
        return String(value);
    });
}

export function buildPromptFragmentManifest(
    agentName: string,
    bindings: readonly PromptFragmentBindingSpec[],
): readonly PromptFragmentManifestEntry[] {
    return bindings.map(({ fragment, templateKey, fragmentSlot }) => ({
        backend: "claude-sdk",
        agentName,
        language: "en",
        codeName: fragment.codeName,
        definitionKey: fragment.definitionKey,
        fragmentName: fragmentSlot,
        defaultVersion: fragment.defaultVersion,
        defaultContent: fragment.defaultContent,
        toolContractVersion: "1",
        outputSchemaVersion: "1",
        bindings: [{ templateKey, fragmentSlot }],
    }));
}
