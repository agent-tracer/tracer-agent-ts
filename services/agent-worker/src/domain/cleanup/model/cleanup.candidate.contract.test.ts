import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentCases } from "~agent-worker/support/contract.js";
import type { CleanupTaskSnapshot } from "./cleanup.candidate.model.js";
import { buildCleanupCandidates } from "./cleanup.candidate.model.js";

interface CleanupCandidateCase {
    readonly name: string;
    readonly tasks: readonly CleanupTaskSnapshot[];
    readonly activeChildParentIds: readonly string[];
    readonly expectedIds: readonly string[];
    readonly expectedReasons?: Readonly<Record<string, readonly string[]>>;
}

const CONTRACT = readAgentCases<{
    candidateCases: { readonly now: string; readonly cases: readonly CleanupCandidateCase[] };
}>(AGENT.taskCleanup.id).candidateCases;

describe("정리 후보 판정", () => {
    it("계약의 케이스마다 같은 후보와 같은 사유를 낸다", () => {
        const now = new Date(CONTRACT.now);

        for (const declared of CONTRACT.cases) {
            const candidates = buildCleanupCandidates({
                tasks: declared.tasks,
                activeChildParentIds: declared.activeChildParentIds,
                now,
            });

            expect(candidates.map((candidate) => candidate.id).sort(), declared.name).toEqual(
                [...declared.expectedIds].sort(),
            );
            for (const [taskId, reasons] of Object.entries(declared.expectedReasons ?? {})) {
                const found = candidates.find((candidate) => candidate.id === taskId);

                expect(found?.candidateReasons, `${declared.name} ${taskId}`).toEqual(reasons);
            }
        }
    });
});
