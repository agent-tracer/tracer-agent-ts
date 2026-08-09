import path from "node:path";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTRACT_ROOT } from "~agent-api/support/contract.js";
import { SEARCH_OUTBOX_TARGET_RECIPE } from "~agent-api/domain/recipe/model/recipe.const.js";
import { SearchOutboxEntity } from "./search.outbox.entity.js";

/** 어느 제약이 거절했는지까지 보지 않으면 다른 제약이 먼저 걸린 것을 이 제약의 거절로 읽는다. */
const CONSTRAINT = "search_outbox_target_check";

let ledger: StartedLedger;

function refusedBy(error: unknown): string | undefined {
    return (error as { driverError?: { constraint?: string } }).driverError?.constraint;
}

function outbox(overrides: Partial<SearchOutboxEntity> = {}): SearchOutboxEntity {
    const row = new SearchOutboxEntity();
    row.id = "outbox-1";
    row.userId = "user-1";
    row.target = SEARCH_OUTBOX_TARGET_RECIPE;
    row.targetId = "recipe-1";
    row.attempts = 0;
    row.lastError = null;
    row.createdAt = new Date("2026-01-01T00:00:00Z");
    return Object.assign(row, overrides);
}

beforeAll(async () => {
    ledger = await startLedger(path.join(CONTRACT_ROOT, "db", "migrations"), [SearchOutboxEntity]);
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
});

describe("에이전트 원장이 소유한 색인 대상은 레시피 하나다", () => {
    // 태스크와 메모는 추적이 자기 원장에서 배출하므로 이 표에 들어오면 아무도 배출하지 않는다.
    it("레시피가 아닌 대상의 적재를 거절한다", async () => {
        const rows = ledger.repository(SearchOutboxEntity);

        await expect(rows.insert(outbox({ target: "task" }))).rejects.toSatisfy(
            (error: unknown) => refusedBy(error) === CONSTRAINT,
        );
    });

    it("레시피 대상의 적재는 받는다", async () => {
        const rows = ledger.repository(SearchOutboxEntity);

        await expect(rows.insert(outbox())).resolves.toBeDefined();
    });
});
