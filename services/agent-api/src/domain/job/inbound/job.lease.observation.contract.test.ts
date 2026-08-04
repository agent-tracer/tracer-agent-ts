import { describe, expect, it } from "vitest";
import { failureBodySchema, reportBodySchema } from "./job.lease.schema.js";
import { readContractJson } from "~agent-api/support/contract.js";

interface JobIntakeCase {
    readonly localExecutor: {
        readonly observation: {
            readonly field: string;
            readonly required: readonly string[];
            readonly optional: readonly string[];
        };
        readonly steps: { readonly field: string };
    };
}

const { observation, steps } = readContractJson<JobIntakeCase>("conformance/cases/job.intake.json").localExecutor;

/** 계약이 요구하는 관측만 담은 최소 본문이다. */
function usage(): Record<string, unknown> {
    return Object.fromEntries(observation.required.map((field) => [field, field === "model" ? "claude" : 1]));
}

describe("종결 창구가 받는 실행 관측", () => {
    it("관측과 궤적이 없는 보고를 거절한다", () => {
        expect(reportBodySchema.safeParse({ rules: [] }).success).toBe(false);
        expect(failureBodySchema.safeParse({ message: "boom" }).success).toBe(false);
    });

    it("계약이 요구하는 관측만 실어도 통과한다", () => {
        const parsed = reportBodySchema.safeParse({ rules: [], [observation.field]: usage(), [steps.field]: [] });

        expect(parsed.success).toBe(true);
        expect(Object.keys(parsed.data?.usage ?? {})).toEqual([...observation.required]);
    });

    it("계약이 적은 관측의 칸을 빠짐없이 받는다", () => {
        const full = { ...usage(), ...Object.fromEntries(observation.optional.map((field) => [field, 2])) };
        const parsed = failureBodySchema.safeParse({ message: "boom", usage: full, steps: [] });

        expect(parsed.success).toBe(true);
        expect(Object.keys(parsed.data?.usage ?? {}).sort())
            .toEqual([...observation.required, ...observation.optional].sort());
    });
});
