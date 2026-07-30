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
    readonly idempotency: { readonly keys: Readonly<Record<string, readonly string[]>> };
}

const { inputs, idempotency } = readContractJson<JobIntakeCase>("conformance/cases/job.intake.json");

describe("잡 멱등 입력의 정규형", () => {
    it("계약이 종류마다 적은 칸을 그 순서대로 본다", () => {
        expect(Object.fromEntries(JOB_KINDS.map((kind) => [kind, [...JOB_IDEMPOTENCY_KEYS[kind]]])))
            .toEqual(idempotency.keys);
    });

    it("계약이 그 종류에 적은 도메인 입력 칸을 하나도 빠뜨리지 않는다", () => {
        expect(Object.keys(inputs).sort()).toEqual([...JOB_KINDS].sort());
        for (const kind of JOB_KINDS) {
            const declared = inputs[kind];
            expect([...JOB_IDEMPOTENCY_KEYS[kind]].sort())
                .toEqual([...(declared?.required ?? []), ...(declared?.optional ?? [])].sort());
        }
    });

    it("고르지 않은 칸을 null로 채운다", () => {
        expect(canonicalJobInput(JOB_KIND.taskCleanup, {})).toBe('{"filters.maxSuggestions":null}');
    });

    it("정한 칸 밖의 값은 판정을 흔들지 않는다", () => {
        const bare = hashJobInput(JOB_KIND.titleSuggestion, { taskId: "t1" });

        expect(hashJobInput(JOB_KIND.titleSuggestion, { taskId: "t1", trigger: "dashboard" })).toBe(bare);
    });
});
