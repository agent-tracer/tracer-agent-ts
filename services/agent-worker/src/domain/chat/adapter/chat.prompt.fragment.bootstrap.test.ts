import { computePromptFragmentHash, extractPromptFragmentPlaceholders, type ResolvedPromptFragment } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
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

describe("initializeChatPromptFragments", () => {
    it("창구가 낸 판으로 스냅샷을 세운다", async () => {
        const snapshot = new ChatPromptFragmentSnapshot();
        await initializeChatPromptFragments(snapshot, { registerAndResolve: async () => RESOLVED }, "local");
        expect(snapshot.read()).toHaveLength(RESOLVED.length);
    });

    it("창구에 닿지 못하면 부팅을 멈춘다", async () => {
        const snapshot = new ChatPromptFragmentSnapshot();
        await expect(initializeChatPromptFragments(snapshot, {
            registerAndResolve: () => Promise.reject(new Error("the prompt fragment registry answered 404")),
        }, "local")).rejects.toThrow();
        expect(snapshot.read()).toHaveLength(0);
    });

    it("빠진 조각이 있으면 부팅을 멈춘다", async () => {
        const snapshot = new ChatPromptFragmentSnapshot();
        await expect(initializeChatPromptFragments(snapshot, {
            registerAndResolve: async () => RESOLVED.slice(1),
        }, "local")).rejects.toThrow("chat.prompt-fragment.incomplete-resolution");
        expect(snapshot.read()).toHaveLength(0);
    });

    it("판의 해시가 어긋나면 부팅을 멈춘다", async () => {
        const snapshot = new ChatPromptFragmentSnapshot();
        const drifted = RESOLVED.map((fragment, index) =>
            index === 0 ? { ...fragment, content: `${fragment.content} 어긋난 판` } : fragment);
        await expect(initializeChatPromptFragments(snapshot, {
            registerAndResolve: async () => drifted,
        }, "local")).rejects.toThrow("chat.prompt-fragment.hash-mismatch");
    });
});
