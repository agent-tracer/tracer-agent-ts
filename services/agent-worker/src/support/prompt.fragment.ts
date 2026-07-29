import { createHash } from "node:crypto";
import type { PromptFragmentManifestEntry } from "@tracer-agent/llm";

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

/** 등록 경계와 다른 구현체가 함께 쓰며 공백과 끝 개행을 보존하는 정규화다. */
export function canonicalPromptFragmentContent(content: string): string {
    return content.replace(/\r\n?/gu, "\n").normalize("NFC");
}

export function computeFragmentHash(content: string): string {
    return createHash("sha256").update(canonicalPromptFragmentContent(content), "utf8").digest("hex");
}

export function extractFragmentPlaceholders(content: string): readonly string[] {
    return [...new Set([...content.matchAll(PLACEHOLDER)].map((match) => match[1]!))].sort();
}

export function definePromptFragment(
    fragment: Omit<PromptFragmentDefault, "contentHash" | "placeholders">,
): PromptFragmentDefault {
    return {
        ...fragment,
        contentHash: computeFragmentHash(fragment.defaultContent),
        placeholders: extractFragmentPlaceholders(fragment.defaultContent),
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
