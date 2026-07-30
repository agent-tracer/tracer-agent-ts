import {
    computePromptFragmentHash,
    extractPromptFragmentPlaceholders,
    type PromptFragmentManifestEntry,
    type ResolvedPromptFragment,
} from "@tracer-agent/llm";

const REGISTER_AND_RESOLVE_PATH = "/internal/prompts/fragments/register-and-resolve";

/**
 * 부팅이 조각 manifest 를 등록 창구에 올리고 이 프로파일이 실행에 쓸 판을 받아 코드 선언과 대조하며,
 * 창구에 닿지 못하거나 판이 어긋나면 던져서 부팅을 멈춘다.
 */
export async function registerAndResolvePromptFragments(
    baseUrl: string,
    profile: string,
    manifest: readonly PromptFragmentManifestEntry[],
): Promise<readonly ResolvedPromptFragment[]> {
    const response = await fetch(`${baseUrl.replace(/\/+$/u, "")}${REGISTER_AND_RESOLVE_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, manifest }),
    });
    if (response.status >= 400) {
        throw new Error(`the prompt fragment registry answered ${response.status}`);
    }
    return verifyResolution(manifest, unwrapEnvelope(await response.json()));
}

/** 에이전트 서비스가 성공 봉투로 실어 주는 목록을 벗겨 낸다. */
function unwrapEnvelope(payload: unknown): readonly ResolvedPromptFragment[] {
    const body = payload as { ok?: unknown; data?: unknown };
    if (body.ok !== true || !Array.isArray(body.data)) {
        throw new Error("prompt-fragment.registration-envelope-rejected");
    }
    return body.data as readonly ResolvedPromptFragment[];
}

function verifyResolution(
    manifest: readonly PromptFragmentManifestEntry[],
    resolved: readonly ResolvedPromptFragment[],
): readonly ResolvedPromptFragment[] {
    const expected = manifest
        .flatMap((entry) =>
            entry.bindings.map((binding) => `${binding.templateKey}/${binding.fragmentSlot}/${entry.definitionKey}`))
        .sort();
    const actual = resolved.map(fragmentIdentity).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        throw new Error("prompt-fragment.incomplete-resolution");
    }
    for (const fragment of resolved) {
        const local = manifest.find((entry) => entry.definitionKey === fragment.definitionKey);
        if (local === undefined) throw new Error("prompt-fragment.definition-mismatch");
        verifyFragment(local, fragment);
    }
    return Object.freeze(resolved.map((fragment) => Object.freeze({ ...fragment })));
}

function verifyFragment(local: PromptFragmentManifestEntry, fragment: ResolvedPromptFragment): void {
    if (computePromptFragmentHash(fragment.content) !== fragment.contentHash) {
        throw new Error("prompt-fragment.hash-mismatch");
    }
    if (
        JSON.stringify(extractPromptFragmentPlaceholders(fragment.content)) !== JSON.stringify(fragment.placeholders)
        || JSON.stringify(extractPromptFragmentPlaceholders(local.defaultContent))
            !== JSON.stringify(fragment.placeholders)
    ) {
        throw new Error("prompt-fragment.placeholder-mismatch");
    }
    if (
        fragment.toolContractVersion !== local.toolContractVersion
        || fragment.outputSchemaVersion !== local.outputSchemaVersion
    ) {
        throw new Error("prompt-fragment.contract-mismatch");
    }
    if (fragment.source === "code-default" && fragment.content !== local.defaultContent) {
        throw new Error("prompt-fragment.code-default-mismatch");
    }
}

function fragmentIdentity(fragment: ResolvedPromptFragment): string {
    return `${fragment.templateKey}/${fragment.fragmentSlot}/${fragment.definitionKey}`;
}
