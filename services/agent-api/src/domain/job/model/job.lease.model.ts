import { readContractJson } from "~agent-api/support/contract.js";

/** 리스를 쥔 실행기와 그 수명이며 실행기가 이 값으로 계속 가지고 있는지 판정한다. */
export interface JobLease {
    readonly held: boolean;
    readonly leaseOwner: string | null;
    readonly leaseExpiresAt: string | null;
}

const { lease } = readContractJson<{ readonly lease: { readonly ttlMs: number } }>(
    "wire/job.kinds.json",
);

/** 리스가 이만큼 살아 있고 하트비트가 이보다 잦아야 다른 실행기가 같은 잡을 가져가지 않는다. */
export const JOB_LEASE_TTL_MS = lease.ttlMs;

export function leaseExpiryFrom(now: Date): Date {
    return new Date(now.getTime() + JOB_LEASE_TTL_MS);
}

/** 리스를 놓친 실행기가 자기 것으로 착각하지 않도록 쥔 사람과 수명을 함께 낸다. */
export function leaseOf(owner: string | null, expiresAt: Date | null, requester: string, now: Date): JobLease {
    const alive = expiresAt !== null && expiresAt.getTime() > now.getTime();
    return {
        held: alive && owner === requester,
        leaseOwner: owner,
        leaseExpiresAt: expiresAt === null ? null : expiresAt.toISOString(),
    };
}
