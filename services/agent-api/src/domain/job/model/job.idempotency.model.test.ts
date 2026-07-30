import { describe, expect, it } from "vitest";
import { JOB_KIND, JOB_KINDS } from "~agent-api/domain/job/model/job.const.js";
import {
    canonicalJobInput,
    hashJobInput,
    JOB_IDEMPOTENCY_KEYS,
} from "~agent-api/domain/job/model/job.idempotency.model.js";
import { readContractJson } from "~agent-api/support/contract.js";

interface JobIntakeCase {
    readonly inputs: Readonly<
        Record<string, { readonly required: readonly string[]; readonly optional: readonly string[] }>
    >;
}

const { inputs } = readContractJson<JobIntakeCase>("conformance/cases/job.intake.json");

describe("잡 멱등 입력의 정규형", () => {
    it("계약이 그 종류에 적은 도메인 입력 칸을 빠짐없이 본다", () => {
        for (const kind of JOB_KINDS) {
            const declared = inputs[kind];
            if (declared === undefined) continue;
            expect([...JOB_IDEMPOTENCY_KEYS[kind]].sort())
                .toEqual([...declared.required, ...declared.optional].sort());
        }
    });

    it("고르지 않은 칸을 null로 채우고 종류가 정한 순서로 적는다", () => {
        expect(canonicalJobInput(JOB_KIND.recipeScan, { taskId: "t1", language: "ko", trigger: "dashboard" }))
            .toBe('{"taskId":"t1","userPrompt":null,"language":"ko","trigger":"dashboard"}');
        expect(canonicalJobInput(JOB_KIND.taskCleanup, {})).toBe('{"filters.maxSuggestions":null}');
    });

    it("중첩된 칸도 계약이 적은 경로로 읽는다", () => {
        expect(canonicalJobInput(JOB_KIND.taskCleanup, { filters: { maxSuggestions: 5 } }))
            .toBe('{"filters.maxSuggestions":5}');
    });

    it("비ASCII를 이스케이프하지 않는다", () => {
        const input = { taskId: "t1", anchorEventId: "ev-1", intent: "테스트를 먼저 쓴다" };

        expect(canonicalJobInput(JOB_KIND.ruleGeneration, input))
            .toBe('{"taskId":"t1","anchorEventId":"ev-1","focus":null,"maxRules":null,"intent":"테스트를 먼저 쓴다"}');
    });

    it("정한 칸 밖의 값은 판정을 흔들지 않는다", () => {
        const bare = hashJobInput(JOB_KIND.titleSuggestion, { taskId: "t1" });

        expect(hashJobInput(JOB_KIND.titleSuggestion, { taskId: "t1", trigger: "dashboard" })).toBe(bare);
    });

    it("같은 정규형은 같은 sha256을 낸다", () => {
        expect(hashJobInput(JOB_KIND.titleSuggestion, { taskId: "t1" }))
            .toBe("1a7bcd7030a7d77b7a78efe30a3e4efd23d6600cbbbe726639e2d25a1253a01b");
    });
});
