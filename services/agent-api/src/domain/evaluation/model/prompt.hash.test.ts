import { readFileSync } from "node:fs";
import { computePromptFragmentHash } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { resolvePromptContentHash } from "./prompt.hash.js";

interface IntegrityCase { readonly name: string; readonly content: string; readonly hash: string }
const { cases } = JSON.parse(
    readFileSync("contract/agent/shared/prompt.fragment.integrity.json", "utf8"),
) as { readonly cases: readonly IntegrityCase[] };

/** 앞뒤 공백과 결합 문자를 함께 실어 정규화 규칙을 구별하는 본문이다. */
const AUTHORED = "  cafe\u0301 body\r\n";

describe("resolvePromptContentHash", () => {
    it.each(cases.map((entry) => [entry.name, entry] as const))(
        "무결성 케이스 %s 의 해시를 계약과 같게 낸다",
        (_name, entry) => {
            expect(resolvePromptContentHash(entry.content)).toBe(entry.hash);
        },
    );

    it("앞뒤 공백을 지우지 않고 결합 문자를 합친 뒤 해시를 낸다", () => {
        expect(resolvePromptContentHash(AUTHORED)).toBe(computePromptFragmentHash(AUTHORED));
    });

    it("요청이 실은 해시가 규칙과 다르면 거절한다", () => {
        expect(() => resolvePromptContentHash(AUTHORED, "0".repeat(64))).toThrow();
    });
});
