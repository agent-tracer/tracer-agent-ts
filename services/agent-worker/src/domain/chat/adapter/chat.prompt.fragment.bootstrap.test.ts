import { computePromptFragmentHash, extractPromptFragmentPlaceholders, type ResolvedPromptFragment } from "@tracer-agent/llm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAT_PROMPT_FRAGMENT_MANIFEST } from "~agent-worker/domain/chat/model/chat.prompt.fragments.js";
import { initializeChatPromptFragments } from "./chat.prompt.fragment.bootstrap.js";
import { ChatPromptFragmentSnapshot } from "./chat.prompt.fragment.snapshot.js";

const RESOLVED: readonly ResolvedPromptFragment[] = CHAT_PROMPT_FRAGMENT_MANIFEST.flatMap((entry) =>
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
    })),
);

afterEach(() => vi.restoreAllMocks());

describe("initializeChatPromptFragments", () => {
    it("창구가 낸 판으로 스냅샷을 세운다", async () => {
        const snapshot = new ChatPromptFragmentSnapshot();
        await initializeChatPromptFragments(snapshot, { registerAndResolve: async () => RESOLVED }, "local");
        expect(snapshot.read()).toHaveLength(RESOLVED.length);
    });

    it("창구에 닿지 못하면 파일 기본값으로 돌고 경고를 남긴다", async () => {
        const written = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        const snapshot = new ChatPromptFragmentSnapshot();
        await initializeChatPromptFragments(snapshot, {
            registerAndResolve: () => Promise.reject(new Error("the prompt fragment registry answered 404")),
        }, "local");
        expect(snapshot.read()).toHaveLength(0);
        expect(String(written.mock.calls[0]?.[0])).toContain("\"msg\":\"agent.prompt.fallback\"");
    });

    it("빠진 조각이 있으면 파일 기본값으로 돈다", async () => {
        vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        const snapshot = new ChatPromptFragmentSnapshot();
        await initializeChatPromptFragments(snapshot, {
            registerAndResolve: async () => RESOLVED.slice(1),
        }, "local");
        expect(snapshot.read()).toHaveLength(0);
    });
});
