import path from "node:path";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTRACT_ROOT } from "~agent-api/support/contract.js";
import { ChatThreadEntity } from "./chat.thread.entity.js";

/** 어느 제약이 거절했는지까지 보지 않으면 다른 제약이 먼저 걸린 것을 이 제약의 거절로 읽는다. */
const CONSTRAINT = "chat_threads_summary_pairing";

function refusedBy(error: unknown): string | undefined {
    return (error as { driverError?: { constraint?: string } }).driverError?.constraint;
}

let ledger: StartedLedger;

function thread(overrides: Partial<ChatThreadEntity> = {}): ChatThreadEntity {
    const row = new ChatThreadEntity();
    row.id = "thread-1";
    row.userId = "user-1";
    row.title = "New conversation";
    row.summary = null;
    row.summaryThroughMessageId = null;
    row.backend = null;
    row.createdAt = new Date("2026-01-01T00:00:00Z");
    row.updatedAt = new Date("2026-01-01T00:00:00Z");
    return Object.assign(row, overrides);
}

beforeAll(async () => {
    ledger = await startLedger(path.join(CONTRACT_ROOT, "db", "migrations"), [ChatThreadEntity]);
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
});

describe("요약과 그 지점의 짝을 원장이 강제한다", () => {
    // 대역은 이 제약을 지우므로 실제 원장에 부딪혀야 이 갈래가 한 번이라도 실행된다.
    it("요약만 있고 지점이 없는 행을 거절한다", async () => {
        const rows = ledger.repository(ChatThreadEntity);

        await expect(rows.save(thread({ summary: "접은 이야기" }))).rejects.toSatisfy(
            (error: unknown) => refusedBy(error) === CONSTRAINT,
        );
    });

    it("지점만 있고 요약이 없는 행을 거절한다", async () => {
        const rows = ledger.repository(ChatThreadEntity);

        await expect(rows.save(thread({ summaryThroughMessageId: "message-9" }))).rejects.toSatisfy(
            (error: unknown) => refusedBy(error) === CONSTRAINT,
        );
    });

    it("둘 다 없는 행을 받는다", async () => {
        const rows = ledger.repository(ChatThreadEntity);

        await expect(rows.save(thread())).resolves.toBeDefined();
    });

    it("둘 다 있는 행을 받는다", async () => {
        const rows = ledger.repository(ChatThreadEntity);
        const saved = thread({ summary: "접은 이야기", summaryThroughMessageId: "message-9" });

        await expect(rows.save(saved)).resolves.toBeDefined();
    });
});
