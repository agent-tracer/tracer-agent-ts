import path from "node:path";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTRACT_ROOT } from "~agent-api/support/contract.js";
import { CLEANUP_SUGGESTION_STATUS } from "~agent-api/domain/cleanup/model/cleanup.const.js";
import { CleanupSuggestionEntity } from "./cleanup.suggestion.entity.js";

/** 어느 색인이 거절했는지까지 보지 않으면 다른 색인이 먼저 걸린 것을 이 색인의 거절로 읽는다. */
const CONSTRAINT = "cleanup_pending_task_kind_unique";

let ledger: StartedLedger;

function refusedBy(error: unknown): string | undefined {
    return (error as { driverError?: { constraint?: string } }).driverError?.constraint;
}

function suggestion(overrides: Partial<CleanupSuggestionEntity> = {}): CleanupSuggestionEntity {
    const row = new CleanupSuggestionEntity();
    row.id = "suggestion-1";
    row.userId = "user-1";
    row.jobId = "job-1";
    row.taskId = "task-1";
    row.kind = "archive";
    row.currentValue = null;
    row.proposedValue = null;
    row.rationale = "사건이 오래 없다";
    row.status = CLEANUP_SUGGESTION_STATUS.pending;
    row.error = null;
    row.createdAt = new Date("2026-01-01T00:00:00Z");
    row.resolvedAt = null;
    row.observedLastEventAt = null;
    return Object.assign(row, overrides);
}

beforeAll(async () => {
    ledger = await startLedger(path.join(CONTRACT_ROOT, "db", "migrations"), [CleanupSuggestionEntity]);
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
});

describe("한 태스크와 한 종류에 대기 중인 제안은 하나다", () => {
    // 다시 스캔해도 대기 행의 수가 늘지 않는 성질이 이 색인에서 나온다.
    it("같은 사용자와 태스크와 종류의 두 번째 대기 행을 거절한다", async () => {
        const rows = ledger.repository(CleanupSuggestionEntity);
        await rows.insert(suggestion());

        await expect(rows.insert(suggestion({ id: "suggestion-2" }))).rejects.toSatisfy(
            (error: unknown) => refusedBy(error) === CONSTRAINT,
        );
    });

    it("앞의 행이 해소되었으면 같은 태스크에 새 대기 행을 만든다", async () => {
        const rows = ledger.repository(CleanupSuggestionEntity);
        await rows.insert(suggestion({ status: CLEANUP_SUGGESTION_STATUS.dismissed }));

        await expect(rows.insert(suggestion({ id: "suggestion-2" }))).resolves.toBeDefined();
    });

    it("태스크가 다르면 같은 사용자에게 대기 행이 여럿 남는다", async () => {
        const rows = ledger.repository(CleanupSuggestionEntity);
        await rows.insert(suggestion());

        await expect(
            rows.insert(suggestion({ id: "suggestion-2", taskId: "task-2" })),
        ).resolves.toBeDefined();
    });
});
