import path from "node:path";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTRACT_ROOT } from "~agent-api/support/contract.js";
import { JobEntity } from "./job.entity.js";

/** 어느 색인이 거절했는지까지 보지 않으면 다른 색인이 먼저 걸린 것을 이 색인의 거절로 읽는다. */
const CONSTRAINT = "ai_jobs_idempotency_key";

let ledger: StartedLedger;

function refusedBy(error: unknown): string | undefined {
    return (error as { driverError?: { constraint?: string } }).driverError?.constraint;
}

function job(overrides: Partial<JobEntity> = {}): JobEntity {
    const row = new JobEntity();
    row.id = "job-1";
    row.userId = "user-1";
    row.kind = "title.suggestion";
    row.executor = "temporal";
    row.backend = "ts";
    row.status = "pending";
    row.attempts = 0;
    row.input = {};
    row.result = {};
    row.usage = {};
    row.idempotencyKey = "key-1";
    row.idempotencyInputHash = "hash-1";
    row.createdAt = new Date("2026-01-01T00:00:00Z");
    row.updatedAt = new Date("2026-01-01T00:00:00Z");
    return Object.assign(row, overrides);
}

beforeAll(async () => {
    ledger = await startLedger(path.join(CONTRACT_ROOT, "db", "migrations"), [JobEntity]);
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
});

describe("같은 멱등 열쇠의 잡은 하나다", () => {
    // 접수는 먼저 넣고 거절을 받아 읽으므로 이 색인이 중복을 막는 유일한 자리다.
    it("같은 사용자와 종류와 열쇠의 두 번째 잡을 거절한다", async () => {
        const rows = ledger.repository(JobEntity);
        await rows.save(job());

        await expect(rows.save(job({ id: "job-2" }))).rejects.toSatisfy(
            (error: unknown) => refusedBy(error) === CONSTRAINT,
        );
    });

    // 열쇠 없는 행이 여럿 서는 것은 부분 색인의 조건이 아니라 원장이 NULL 을 서로 다른 값으로 보기 때문이며 조건을 지워도 이 갈래는 그대로 선다.
    it("멱등 열쇠가 없는 잡은 여럿 선다", async () => {
        const rows = ledger.repository(JobEntity);
        const anonymous = { idempotencyKey: null, idempotencyInputHash: null };
        await rows.save(job(anonymous));

        await expect(rows.save(job({ id: "job-2", ...anonymous }))).resolves.toBeDefined();
    });

    it("종류가 다르면 같은 열쇠를 쓴다", async () => {
        const rows = ledger.repository(JobEntity);
        await rows.save(job());

        await expect(rows.save(job({ id: "job-2", kind: "recipe.scan" }))).resolves.toBeDefined();
    });

    it("사용자가 다르면 같은 열쇠를 쓴다", async () => {
        const rows = ledger.repository(JobEntity);
        await rows.save(job());

        await expect(rows.save(job({ id: "job-2", userId: "user-2" }))).resolves.toBeDefined();
    });
});
