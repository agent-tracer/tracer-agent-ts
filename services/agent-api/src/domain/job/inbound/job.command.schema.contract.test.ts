import { describe, expect, it } from "vitest";
import { JOB_KINDS } from "~agent-api/domain/job/model/job.const.js";
import { readContractJson } from "~agent-api/support/contract.js";
import { enqueueBodySchema } from "./job.command.schema.js";

interface JobIntakeCase {
    readonly kinds: readonly string[];
    readonly body: { readonly constraints: { readonly kind: { readonly enum: readonly string[] } } };
}

const intake = readContractJson<JobIntakeCase>("conformance/cases/job.intake.json");

/** 접수 창구가 실제로 통과시키는 잡 종류다. */
function acceptedKinds(): string[] {
    return intake.body.constraints.kind.enum.filter(
        (kind) => enqueueBodySchema.safeParse(kindProbe(kind)).error?.issues[0]?.path[0] !== "kind",
    );
}

function kindProbe(kind: string): Record<string, unknown> {
    return { kind, input: { taskId: "t1", anchorEventId: "ev-1" } };
}

describe("잡 접수 표면", () => {
    it("접수가 받는 잡 종류를 계약과 같게 안다", () => {
        expect([...JOB_KINDS].sort()).toEqual([...intake.kinds].sort());
    });

    it("계약이 적은 종류를 창구가 하나도 빠짐없이 통과시킨다", () => {
        expect(acceptedKinds().sort()).toEqual([...intake.kinds].sort());
    });

    it("계약에 없는 종류를 창구가 거절한다", () => {
        expect(enqueueBodySchema.safeParse(kindProbe("rule.promotion")).success).toBe(false);
    });
});
