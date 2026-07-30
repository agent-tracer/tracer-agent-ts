import { describe, expect, it } from "vitest";
import type { JobKind } from "~agent-api/domain/job/model/job.const.js";
import { JOB_KINDS } from "~agent-api/domain/job/model/job.const.js";
import { canonicalJobInput, hashJobInput } from "~agent-api/domain/job/model/job.idempotency.model.js";
import { readContractJson } from "~agent-api/support/contract.js";
import { enqueueBodySchema } from "./job.command.schema.js";

interface IdempotencyCase {
    readonly name: string;
    readonly kind: string;
    readonly input: Record<string, unknown>;
    readonly canonical: string;
    readonly hash: string;
}

interface JobIntakeCase {
    readonly kinds: readonly string[];
    readonly body: { readonly constraints: { readonly kind: { readonly enum: readonly string[] } } };
    readonly idempotency: { readonly digest: string; readonly cases: readonly IdempotencyCase[] };
}

const intake = readContractJson<JobIntakeCase>("conformance/cases/job.intake.json");
const { idempotency } = intake;

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

describe("접수가 다듬은 입력의 멱등 정규형", () => {
    it.each(idempotency.cases)("$name", ({ kind, input, canonical, hash }) => {
        const parsed = enqueueBodySchema.parse({ kind, input, idempotencyKey: "k1" });

        expect(canonicalJobInput(kind as JobKind, parsed.input ?? {})).toBe(canonical);
        expect(hashJobInput(kind as JobKind, parsed.input ?? {})).toBe(hash);
    });

    it("계약이 정한 다이제스트로 판정한다", () => {
        expect(idempotency.digest).toBe("sha256");
    });
});
