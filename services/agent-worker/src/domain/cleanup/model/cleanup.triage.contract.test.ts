import { describe, expect, it } from "vitest";
import { CLEANUP_PROMPT } from "~agent-worker/domain/cleanup/port/__fakes__/cleanup.test-support.js";
import { readCase } from "~agent-worker/support/contract.js";
import type { CleanupBatch } from "./cleanup.candidate.model.js";
import { buildCleanupTriagePrompt } from "./cleanup.prompt.js";

interface TriageCase {
    readonly name: string;
    readonly input: CleanupBatch & { readonly triageCandidateListLimit?: number };
    readonly mustContain?: readonly string[];
    readonly mustNotContain?: readonly string[];
}

const CASES = readCase<{ triage: { readonly cases: readonly TriageCase[] } }>("cleanup.prompt").triage
    .cases;

describe("선별자가 받는 후보 목록", () => {
    it("계약의 케이스마다 같은 목록을 낸다", () => {
        for (const declared of CASES) {
            const { text } = buildCleanupTriagePrompt(
                CLEANUP_PROMPT,
                declared.input,
                declared.input.triageCandidateListLimit ?? 100,
            );

            for (const line of declared.mustContain ?? []) {
                expect(text, declared.name).toContain(line);
            }
            for (const line of declared.mustNotContain ?? []) {
                expect(text, declared.name).not.toContain(line);
            }
        }
    });
});
