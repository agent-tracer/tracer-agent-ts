import {
    computePromptFragmentHash,
    extractPromptFragmentPlaceholders,
    type PromptFragmentManifestEntry,
    type ResolvedPromptFragment,
} from "@tracer-agent/llm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLEANUP_PROMPT_FRAGMENT_MANIFEST } from "~agent-worker/domain/cleanup/model/cleanup.prompt.fragments.js";
import { RECIPE_PROMPT_FRAGMENT_MANIFEST } from "~agent-worker/domain/recipe/model/recipe.prompt.fragments.js";
import { TITLE_PROMPT_FRAGMENT_MANIFEST } from "~agent-worker/domain/title/model/title.prompt.fragments.js";
import { registerAndResolvePromptFragments } from "./prompt.fragment.registration.js";

const JOB_MANIFEST: readonly PromptFragmentManifestEntry[] = [
    ...RECIPE_PROMPT_FRAGMENT_MANIFEST,
    ...CLEANUP_PROMPT_FRAGMENT_MANIFEST,
    ...TITLE_PROMPT_FRAGMENT_MANIFEST,
];

function resolveLocally(
    manifest: readonly PromptFragmentManifestEntry[],
): readonly ResolvedPromptFragment[] {
    return manifest.flatMap((entry) =>
        entry.bindings.map((binding) => ({
            templateKey: binding.templateKey,
            fragmentSlot: binding.fragmentSlot,
            definitionKey: entry.definitionKey,
            codeName: entry.codeName,
            backend: entry.backend,
            language: entry.language,
            versionId: `${entry.definitionKey}#1`,
            semanticVersion: entry.defaultVersion,
            content: entry.defaultContent,
            contentHash: computePromptFragmentHash(entry.defaultContent),
            placeholders: extractPromptFragmentPlaceholders(entry.defaultContent),
            toolContractVersion: entry.toolContractVersion,
            outputSchemaVersion: entry.outputSchemaVersion,
            source: "code-default" as const,
        })));
}

/** 자리표가 없는 마지막 조각만 바꿔서 자리표 검사가 아니라 본문 검사가 걸리게 한다. */
function withRewrittenTail(content: string, source: ResolvedPromptFragment["source"]): ResolvedPromptFragment[] {
    const fragments = [...resolveLocally(JOB_MANIFEST)];
    const last = fragments[fragments.length - 1] as ResolvedPromptFragment;
    fragments[fragments.length - 1] = {
        ...last,
        content,
        contentHash: computePromptFragmentHash(content),
        placeholders: extractPromptFragmentPlaceholders(content),
        source,
    };
    return fragments;
}

function answer(data: unknown, status = 200): void {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(data), { status }))));
}

async function register(): Promise<readonly ResolvedPromptFragment[]> {
    return registerAndResolvePromptFragments("http://agent-api:8080/", "prd", JOB_MANIFEST);
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("registerAndResolvePromptFragments", () => {
    it("잡 에이전트 셋의 조각 정의를 한 번의 요청으로 올린다", async () => {
        const calls: { readonly url: string; readonly body: string }[] = [];
        vi.stubGlobal("fetch", vi.fn((url: string, init: { readonly body: string }) => {
            calls.push({ url, body: init.body });
            return Promise.resolve(new Response(JSON.stringify({ ok: true, data: resolveLocally(JOB_MANIFEST) })));
        }));
        const resolved = await register();
        expect(calls).toHaveLength(1);
        expect(calls[0]?.url).toBe("http://agent-api:8080/internal/prompts/fragments/register-and-resolve");
        expect(JSON.parse(calls[0]?.body ?? "")).toStrictEqual({ profile: "prd", manifest: JOB_MANIFEST });
        expect(resolved).toHaveLength(JOB_MANIFEST.length);
    });

    it("세 에이전트의 조각 정의가 스물여덟이고 템플릿 키가 열이다", () => {
        expect(JOB_MANIFEST).toHaveLength(28);
        expect(new Set(JOB_MANIFEST.flatMap((entry) => entry.bindings.map((binding) => binding.templateKey))).size)
            .toBe(10);
        expect(new Set(JOB_MANIFEST.map((entry) => entry.definitionKey)).size).toBe(28);
        expect(new Set(JOB_MANIFEST.map((entry) => entry.codeName)).size).toBe(28);
        expect(JOB_MANIFEST.every((entry) => entry.backend === "claude-sdk")).toBe(true);
    });

    it("창구가 실패를 내면 부팅을 멈춘다", async () => {
        answer({ ok: false }, 500);
        await expect(register()).rejects.toThrow("the prompt fragment registry answered 500");
    });

    it("실패 봉투를 받으면 부팅을 멈춘다", async () => {
        answer({ ok: false, error: { code: "prompt.fragment-registration-failed" } });
        await expect(register()).rejects.toThrow("prompt-fragment.registration-envelope-rejected");
    });

    it("빠진 조각이 있으면 부팅을 멈춘다", async () => {
        answer({ ok: true, data: resolveLocally(JOB_MANIFEST).slice(1) });
        await expect(register()).rejects.toThrow("prompt-fragment.incomplete-resolution");
    });

    it("판의 해시가 어긋나면 부팅을 멈춘다", async () => {
        const drifted = resolveLocally(JOB_MANIFEST)
            .map((fragment, index) => (index === 0 ? { ...fragment, content: `${fragment.content} 어긋난 판` } : fragment));
        answer({ ok: true, data: drifted });
        await expect(register()).rejects.toThrow("prompt-fragment.hash-mismatch");
    });

    it("코드 기본값이라 말하면서 본문이 다르면 부팅을 멈춘다", async () => {
        answer({ ok: true, data: withRewrittenTail("다른 판", "code-default") });
        await expect(register()).rejects.toThrow("prompt-fragment.code-default-mismatch");
    });

    it("도구 계약 판이 어긋나면 부팅을 멈춘다", async () => {
        const drifted = resolveLocally(JOB_MANIFEST)
            .map((fragment, index) => (index === 0 ? { ...fragment, toolContractVersion: "2" } : fragment));
        answer({ ok: true, data: drifted });
        await expect(register()).rejects.toThrow("prompt-fragment.contract-mismatch");
    });

    it("작성된 판을 받으면 그것을 실행 판으로 낸다", async () => {
        answer({ ok: true, data: withRewrittenTail("작성한 판", "database-override") });
        const resolved = await register();
        expect(resolved.at(-1)?.content).toBe("작성한 판");
        expect(resolved.at(-1)?.source).toBe("database-override");
    });
});
