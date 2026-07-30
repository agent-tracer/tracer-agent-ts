import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
    canonicalizePromptFragment,
    computePromptFragmentHash,
    extractPromptFragmentPlaceholders,
} from "./prompt.resolution.js";

interface IntegrityCase {
    readonly name: string;
    readonly content: string;
    readonly canonical: string;
    readonly hash: string;
    readonly placeholders: readonly string[];
}

const CONTRACT_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../contract",
);

const { cases } = JSON.parse(
    readFileSync(path.join(CONTRACT_ROOT, "agent/shared/prompt.fragment.integrity.json"), "utf8"),
) as { readonly cases: readonly IntegrityCase[] };

describe("프롬프트 조각 무결성", () => {
    it("계약이 대조할 케이스를 갖고 있다", () => {
        expect(cases.length).toBeGreaterThan(0);
    });

    for (const entry of cases) {
        it(`${entry.name} 의 정규화를 계약과 같게 낸다`, () => {
            expect(canonicalizePromptFragment(entry.content)).toBe(entry.canonical);
        });

        it(`${entry.name} 의 해시를 계약과 같게 낸다`, () => {
            expect(computePromptFragmentHash(entry.content)).toBe(entry.hash);
        });

        it(`${entry.name} 의 자리표시자를 계약과 같게 낸다`, () => {
            expect(extractPromptFragmentPlaceholders(entry.content)).toEqual(entry.placeholders);
        });
    }
});
