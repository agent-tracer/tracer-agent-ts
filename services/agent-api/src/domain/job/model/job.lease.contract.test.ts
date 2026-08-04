import { describe, expect, it } from "vitest";
import { LeaseOwnerMissingError } from "~agent-api/domain/job/model/job.errors.js";
import { readContractJson } from "~agent-api/support/contract.js";

interface Rejection {
    readonly status: number;
    readonly code: string;
    readonly message: string;
}

interface JobIntakeCase {
    readonly rejections: readonly Rejection[];
    readonly leaseOwner: { readonly header: string; readonly rejection: string; readonly paths: readonly string[] };
}

const { rejections, leaseOwner } = readContractJson<JobIntakeCase>("conformance/cases/job.intake.json");
const declared = rejections.find((rejection) => rejection.code === leaseOwner.rejection);

describe("리스 소유자 거절", () => {
    it("계약이 적은 상태와 낱말과 문구를 그대로 낸다", () => {
        const error = new LeaseOwnerMissingError();

        expect(error.httpStatus).toBe(declared?.status);
        expect(error.code).toBe(leaseOwner.rejection);
        expect(error.message).toBe(declared?.message);
    });

    it("리스를 요구하는 창구를 계약이 다섯 자리로 적는다", () => {
        expect(leaseOwner.paths.every((path) => path.startsWith("/api/agent/jobs/"))).toBe(true);
        expect(leaseOwner.paths).toHaveLength(5);
    });
});
