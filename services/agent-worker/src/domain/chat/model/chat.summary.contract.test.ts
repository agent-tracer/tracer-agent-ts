import { describe, expect, it } from "vitest";
import { readContractJson } from "~agent-worker/support/contract.js";
import { CHAT_SUMMARY_SPEC, shouldSummarize } from "./chat.summary.spec.js";

interface DeclaredSummary {
    readonly production: {
        readonly trigger: { readonly messages: number; readonly chars: number; readonly charsUnit: string };
    };
}

const DECLARED = readContractJson<DeclaredSummary>("agent/chat/summary.json").production.trigger;

/** 계약이 정한 글자 수만큼을 BMP 밖 글자 하나씩으로 채운 이력이다. */
function astralMessages(codePoints: number): { readonly content: string }[] {
    return [{ content: "😀".repeat(codePoints) }];
}

describe("요약 문턱", () => {
    it("계약이 적은 문턱과 그 단위를 그대로 읽는다", () => {
        expect(CHAT_SUMMARY_SPEC.triggerCharBudget).toBe(DECLARED.chars);
        expect(CHAT_SUMMARY_SPEC.triggerMessageCount).toBe(DECLARED.messages);
        expect(CHAT_SUMMARY_SPEC.triggerCharUnit).toBe("codePoint");
    });

    it("문턱과 같은 코드포인트 수까지는 접지 않는다", () => {
        expect(shouldSummarize(astralMessages(DECLARED.chars))).toBe(false);
    });

    it("BMP 밖 글자를 코드 유닛이 아니라 코드포인트로 센다", () => {
        const justUnder = astralMessages(DECLARED.chars);

        expect(justUnder[0]!.content.length).toBeGreaterThan(DECLARED.chars);
        expect(shouldSummarize(justUnder)).toBe(false);
    });

    it("문턱을 코드포인트로 넘기면 접는다", () => {
        expect(shouldSummarize(astralMessages(DECLARED.chars + 1))).toBe(true);
    });
});
