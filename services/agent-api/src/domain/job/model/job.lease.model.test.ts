import { describe, expect, it } from "vitest";
import { JOB_LEASE_TTL_MS, leaseExpiryFrom, leaseOf } from "~agent-api/domain/job/model/job.lease.model.js";
import { readContractJson } from "~agent-api/support/contract.js";

const NOW = new Date("2026-08-02T00:00:00.000Z");
const LATER = new Date(NOW.getTime() + 1_000);
const EARLIER = new Date(NOW.getTime() - 1_000);

describe("잡 리스", () => {
    it("계약이 적은 수명을 그대로 쓴다", () => {
        const { lease } = readContractJson<{ readonly lease: { readonly ttlMs: number } }>(
            "wire/job.kinds.json",
        );

        expect(JOB_LEASE_TTL_MS).toBe(lease.ttlMs);
        expect(leaseExpiryFrom(NOW).getTime()).toBe(NOW.getTime() + lease.ttlMs);
    });

    it("쥔 사람이 부른 사람과 같고 아직 살아 있을 때만 쥔 것으로 본다", () => {
        expect(leaseOf("worker-1", LATER, "worker-1", NOW).held).toBe(true);
        expect(leaseOf("worker-1", LATER, "worker-2", NOW).held).toBe(false);
        expect(leaseOf("worker-1", EARLIER, "worker-1", NOW).held).toBe(false);
        expect(leaseOf(null, null, "worker-1", NOW).held).toBe(false);
    });

    it("쥔 사람과 수명을 그대로 낸다", () => {
        expect(leaseOf("worker-1", LATER, "worker-2", NOW)).toEqual({
            held: false,
            leaseOwner: "worker-1",
            leaseExpiresAt: LATER.toISOString(),
        });
    });
});
