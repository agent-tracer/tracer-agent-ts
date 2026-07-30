import { sha256 } from "~llm/support/sha256.js";

const PLACEHOLDER_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** 조각을 올린 에이전트 서비스를 가르는 이름이며 배포의 상류 선언이 그 값을 정한다. */
export type PromptFragmentBackend = string;

export type PromptFragmentSource = "code-default" | "database-override";

/** channel을 한 번 해소한 뒤 실행 수명 동안 바뀌지 않는, 본문 없이 식별자와 해시만 싣는 프롬프트 계약이다. */
export interface ResolvedAgentPrompt {
    readonly versionId: string;
    readonly semanticVersion: string;
    readonly contentHash: string;
    readonly toolContractVersion: string;
    readonly outputSchemaVersion: string;
}

export interface PromptFragmentSnapshot {
    readonly templateKey: string;
    readonly fragmentSlot: string;
    readonly definitionKey: string;
    readonly versionId: string;
    readonly semanticVersion: string;
    readonly source: PromptFragmentSource;
    readonly contentHash: string;
    readonly placeholders: readonly string[];
    readonly toolContractVersion: string;
    readonly outputSchemaVersion: string;
}

/** 시작 시 검증을 끝내고 실행 수명 동안 고정하는 두 구현체 공통의 조각 값이다. */
export interface ResolvedPromptFragment {
    readonly templateKey: string;
    readonly fragmentSlot: string;
    readonly definitionKey: string;
    readonly codeName: string;
    readonly backend: PromptFragmentBackend;
    readonly language: string;
    readonly versionId: string;
    readonly semanticVersion: string;
    readonly content: string;
    readonly contentHash: string;
    readonly placeholders: readonly string[];
    readonly toolContractVersion: string;
    readonly outputSchemaVersion: string;
    readonly source: PromptFragmentSource;
}

/** 코드 scaffold의 한 slot에 고정된 프래그먼트 사용 관계다. */
export interface PromptFragmentBinding {
    readonly templateKey: string;
    readonly fragmentSlot: string;
    readonly definitionKey: string;
    readonly codeName: string;
    readonly backend: PromptFragmentBackend;
    readonly language: string;
    readonly codeDefaultVersion: string;
}

/** 백엔드가 자기 코드 기본값을 등록 경계로 내보내는 manifest 항목이다. */
export interface PromptFragmentManifestEntry {
    readonly backend: PromptFragmentBackend;
    readonly agentName: string;
    readonly language: string;
    readonly codeName: string;
    readonly definitionKey: string;
    readonly fragmentName: string;
    readonly defaultVersion: string;
    readonly defaultContent: string;
    readonly toolContractVersion: string;
    readonly outputSchemaVersion: string;
    readonly bindings: readonly {
        readonly templateKey: string;
        readonly fragmentSlot: string;
    }[];
}

export interface RegisterAndResolvePromptFragmentsRequest {
    readonly profile: string;
    readonly manifest: readonly PromptFragmentManifestEntry[];
}

export interface ResolvedPromptTemplateHash {
    readonly templateKey: string;
    readonly contentHash: string;
}

export interface ResolvedPromptBundleHash {
    readonly resolvedPromptHashes: readonly ResolvedPromptTemplateHash[];
    readonly resolvedPromptHash: string;
}

/** 봉투의 promptIntegrity.mode 로 오가는 값이며 이름은 계약의 조각 무결성 선언이 소유한다. */
export const PROMPT_INTEGRITY_MODES = ["full-prompt", "resolved-fragments", "fragment-content-only"] as const;

export type PromptIntegrityMode = (typeof PROMPT_INTEGRITY_MODES)[number];

export type PromptIntegrityContract =
    | { readonly mode: "full-prompt" }
    | {
          readonly mode: "resolved-fragments";
          readonly fragments: readonly ResolvedPromptFragment[];
          readonly resolvedPromptHash: string;
          readonly resolvedPromptHashes: readonly ResolvedPromptTemplateHash[];
      }
    | {
          /** 등록 경계가 조각 본문의 무결성만 검증하고 최종 prompt 해시는 렌더링하는 쪽이 산출한다. */
          readonly mode: "fragment-content-only";
          readonly fragments: readonly ResolvedPromptFragment[];
      };

/** 한 실행이 쓰는 시스템 프롬프트 전부를 키로 담는 번들이며 요구하는 키 집합은 각 에이전트가 소유한다. */
export type AgentPromptBundle = Readonly<Record<string, string>>;

export function canonicalizePromptFragment(content: string): string {
    return content.normalize("NFC").replace(/\r\n?/g, "\n");
}

export function computePromptFragmentHash(content: string): string {
    return sha256(canonicalizePromptFragment(content));
}

export function extractPromptFragmentPlaceholders(content: string): readonly string[] {
    const found = new Set<string>();
    for (const match of content.matchAll(PLACEHOLDER_PATTERN)) found.add(match[1] as string);
    return [...found].sort();
}

/** 코드 scaffold와 해소된 조각을 모두 조립한 최종 prompt 문자열을 결정적으로 식별한다. */
export function computeResolvedPromptHash(prompt: string): string {
    return sha256(canonicalizePromptFragment(prompt));
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
