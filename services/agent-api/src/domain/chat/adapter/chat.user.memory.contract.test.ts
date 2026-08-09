import path from "node:path";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTRACT_ROOT } from "~agent-api/support/contract.js";
import { ChatUserMemoryEntity } from "./chat.user.memory.entity.js";

/** 어느 색인이 거절했는지까지 보지 않으면 다른 색인이 먼저 걸린 것을 이 색인의 거절로 읽는다. */
const CONSTRAINT = "chat_user_memories_unique";

let ledger: StartedLedger;

function refusedBy(error: unknown): string | undefined {
    return (error as { driverError?: { constraint?: string } }).driverError?.constraint;
}

function memory(overrides: Partial<ChatUserMemoryEntity> = {}): ChatUserMemoryEntity {
    const row = new ChatUserMemoryEntity();
    row.id = "memory-1";
    row.userId = "user-1";
    row.key = "preferred_language";
    row.content = "한국어로 답한다";
    row.createdAt = new Date("2026-01-01T00:00:00Z");
    row.updatedAt = new Date("2026-01-01T00:00:00Z");
    return Object.assign(row, overrides);
}

beforeAll(async () => {
    ledger = await startLedger(path.join(CONTRACT_ROOT, "db", "migrations"), [ChatUserMemoryEntity]);
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
});

describe("한 사용자의 한 열쇠는 사실 하나다", () => {
    // 계약의 도구 설명이 "같은 열쇠를 다시 기억하면 옛 내용을 덮는다" 고 모델에게 말하는데 그 성질이 이 색인에서 나온다.
    it("같은 사용자와 열쇠의 두 번째 행을 거절한다", async () => {
        const rows = ledger.repository(ChatUserMemoryEntity);
        await rows.save(memory());

        await expect(rows.save(memory({ id: "memory-2" }))).rejects.toSatisfy(
            (error: unknown) => refusedBy(error) === CONSTRAINT,
        );
    });

    it("열쇠가 다르면 같은 사용자에게 여럿 남는다", async () => {
        const rows = ledger.repository(ChatUserMemoryEntity);
        await rows.save(memory());

        await expect(
            rows.save(memory({ id: "memory-2", key: "workspace" })),
        ).resolves.toBeDefined();
    });

    it("사용자가 다르면 같은 열쇠를 쓴다", async () => {
        const rows = ledger.repository(ChatUserMemoryEntity);
        await rows.save(memory());

        await expect(
            rows.save(memory({ id: "memory-2", userId: "user-2" })),
        ).resolves.toBeDefined();
    });
});
