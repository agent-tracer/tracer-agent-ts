import path from "node:path";
import { AGENT_AXIS, AGENT_BACKEND, type AgentAxis } from "@tracer-agent/llm";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTRACT_ROOT } from "~agent-api/support/contract.js";
import { SEARCH_OUTBOX_TARGET_RECIPE } from "~agent-api/domain/recipe/model/recipe.const.js";
import { SearchOutboxEntity } from "./search.outbox.entity.js";

/** 어느 제약이 거절했는지까지 보지 않으면 다른 제약이 먼저 걸린 것을 이 제약의 거절로 읽는다. */
const CONSTRAINT = "search_outbox_target_check";

/** 축의 어휘를 원장이 지키는 자리이며 이 이름의 거절만 그 자리의 거절로 본다. */
const AXIS_CONSTRAINT = "search_outbox_backend_check";

/** 이 축이 아닌 축 하나이며 두 축이 같은 표를 볼 때 무엇이 함께 서는지를 보인다. */
const FOREIGN_AXIS = Object.values(AGENT_AXIS).filter((axis) => axis !== AGENT_BACKEND)[0]!;

let ledger: StartedLedger;

function refusedBy(error: unknown): string | undefined {
    return (error as { driverError?: { constraint?: string } }).driverError?.constraint;
}

function outbox(overrides: Partial<SearchOutboxEntity> = {}): SearchOutboxEntity {
    const row = new SearchOutboxEntity();
    row.id = "outbox-1";
    row.backend = AGENT_BACKEND;
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

describe("적재한 행은 어느 축이 만들었는지를 남긴다", () => {
    // 축의 어휘를 원장이 지키지 않으면 오타 하나가 배출되지 않는 행으로 남는다.
    it("계약이 정한 어휘가 아닌 축의 적재를 거절한다", async () => {
        const rows = ledger.repository(SearchOutboxEntity);

        await expect(rows.insert(outbox({ backend: "rust" as AgentAxis }))).rejects.toSatisfy(
            (error: unknown) => refusedBy(error) === AXIS_CONSTRAINT,
        );
    });

    it("두 축이 적재한 행이 한 표에 함께 선다", async () => {
        const rows = ledger.repository(SearchOutboxEntity);

        await rows.insert(outbox());
        await rows.insert(outbox({ id: "outbox-2", backend: FOREIGN_AXIS }));

        await expect(rows.count()).resolves.toBe(2);
    });
});
