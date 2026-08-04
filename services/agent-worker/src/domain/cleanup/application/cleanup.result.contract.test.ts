import { describe, expect, it } from "vitest";
import { readContractJson } from "~agent-worker/support/contract.js";
import { seedRepository } from "~agent-worker/domain/cleanup/port/__fakes__/cleanup.test-support.js";

interface JobIntakeCase {
    readonly results: {
        readonly byKind: Record<string, { readonly required: readonly string[] }>;
    };
}

const declared = readContractJson<JobIntakeCase>("conformance/cases/job.intake.json")
    .results.byKind["task.cleanup"]!;

describe("정리 잡의 산출", () => {
    it("계약이 적은 칸을 빠짐없이 싣는다", async () => {
        const repository = seedRepository();
        await repository.commitCleanup({
            jobId: "job-1",
            userId: "user-1",
            tasksScanned: 3,
            suggestions: [{ kind: "archive", taskId: "t1", rationale: "이유", evidenceEventIds: ["e1"] }],
            steps: [],
            attempt: 1,
            usage: {},
            observation: null,
            now: new Date(),
        });

        const written = repository.commits[0]!;
        const result = { suggestions: written.suggestions, tasksScanned: written.tasksScanned };
        expect(Object.keys(result).sort()).toEqual([...declared.required].sort());
    });
});
