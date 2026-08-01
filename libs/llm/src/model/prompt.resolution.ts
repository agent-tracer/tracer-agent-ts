import { sha256 } from "~llm/support/sha256.js";

/** channel을 한 번 해소한 뒤 실행 수명 동안 바뀌지 않는, 본문 없이 식별자와 해시만 싣는 프롬프트 계약이다. */
export interface ResolvedAgentPrompt {
    readonly versionId: string;
    readonly semanticVersion: string;
    readonly contentHash: string;
    readonly toolContractVersion: string;
    readonly outputSchemaVersion: string;
}

export interface ResolvedPromptTemplateHash {
    readonly templateKey: string;
    readonly contentHash: string;
}

export interface ResolvedPromptBundleHash {
    readonly resolvedPromptHashes: readonly ResolvedPromptTemplateHash[];
    readonly resolvedPromptHash: string;
}

/** 한 실행이 쓰는 시스템 프롬프트 전부를 키로 담는 번들이며 요구하는 키 집합은 각 에이전트가 소유한다. */
export type AgentPromptBundle = Readonly<Record<string, string>>;

/** 줄 끝과 유니코드 합성이 달라도 같은 본문이 같은 해시를 내도록 표기를 하나로 모은다. */
export function canonicalizePrompt(content: string): string {
    return content.normalize("NFC").replace(/\r\n?/g, "\n");
}

/** 조립을 끝낸 최종 prompt 문자열을 결정적으로 식별한다. */
export function computeResolvedPromptHash(prompt: string): string {
    return sha256(canonicalizePrompt(prompt));
}

/** template key 오름차순과 UTF-8 byte length prefix로 묶되 단일 template은 그 content hash를 그대로 쓴다. */
export function computeResolvedPromptBundleHash(
    templates:
        | Readonly<Record<string, string>>
        | readonly { readonly templateKey: string; readonly content: string }[],
): ResolvedPromptBundleHash {
    const entries: readonly [string, string][] = Array.isArray(templates)
        ? templates.map(({ templateKey, content }) => [templateKey, content])
        : Object.entries(templates);
    if (entries.length === 0) throw new Error("resolved-prompt-bundle.empty");
    const keys = new Set<string>();
    const resolvedPromptHashes = entries
        .map(([templateKey, content]) => {
            if (templateKey.trim().length === 0) throw new Error("resolved-prompt-bundle.empty-template-key");
            if (keys.has(templateKey)) throw new Error("resolved-prompt-bundle.duplicate-template-key");
            keys.add(templateKey);
            return { templateKey, contentHash: computeResolvedPromptHash(content) };
        })
        .sort((left, right) => left.templateKey.localeCompare(right.templateKey));
    if (resolvedPromptHashes.length === 1) {
        return { resolvedPromptHashes, resolvedPromptHash: resolvedPromptHashes[0]!.contentHash };
    }
    const encoder = new TextEncoder();
    const canonical = resolvedPromptHashes
        .map(
            ({ templateKey, contentHash }) =>
                `${encoder.encode(templateKey).length}:${templateKey}${encoder.encode(contentHash).length}:${contentHash}`,
        )
        .join("");
    return { resolvedPromptHashes, resolvedPromptHash: sha256(canonical) };
}

export function verifyResolvedPromptBundleHash(
    templates:
        | Readonly<Record<string, string>>
        | readonly { readonly templateKey: string; readonly content: string }[],
    expected: ResolvedPromptBundleHash,
): void {
    const actual = computeResolvedPromptBundleHash(templates);
    if (
        actual.resolvedPromptHash !== expected.resolvedPromptHash
        || JSON.stringify(actual.resolvedPromptHashes) !== JSON.stringify(expected.resolvedPromptHashes)
    ) {
        throw new Error("resolved-prompt-bundle.hash-mismatch");
    }
}
