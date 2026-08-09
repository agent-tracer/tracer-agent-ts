import path from "node:path";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CHAT_EXECUTION_STATUS } from "~agent-api/domain/chat/model/chat.const.js";
import { CONTRACT_ROOT } from "~agent-api/support/contract.js";
import { ChatExecutionEntity } from "./chat.execution.entity.js";

let ledger: StartedLedger;

/** 멱등 색인이 먼저 걸리면 보려던 제약에 닿지 못하므로 접수 좌표는 행마다 다르게 둔다. */
function execution(overrides: Partial<ChatExecutionEntity> = {}): ChatExecutionEntity {
    const row = new ChatExecutionEntity();
    row.id = "exec-1";
    row.threadId = "thread-1";
    row.userId = "user-1";
    row.status = CHAT_EXECUTION_STATUS.running;
    row.requestedBackend = "ts";
    row.replayAnchorMessageId = "message-1";
    row.clientRequestId = `request-${(overrides.id ?? "exec-1")}`;
    row.inputHash = "hash-1";
    row.draftText = "";
    row.draftSeq = 0;
    row.attempt = 0;
    row.usage = {};
    row.createdAt = new Date("2026-01-01T00:00:00Z");
    row.updatedAt = new Date("2026-01-01T00:00:00Z");
    return Object.assign(row, overrides);
}

beforeAll(async () => {
    ledger = await startLedger(path.join(CONTRACT_ROOT, "db", "migrations"), [ChatExecutionEntity]);
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
});

describe("한 스레드에 실행 중인 실행은 하나다", () => {
    // 대역은 이 색인을 지우고 플래그로 대신하므로 실제 원장에 부딪혀야 이 갈래가 한 번이라도 실행된다.
    it("같은 스레드에 두 번째 running 을 거절한다", async () => {
        const rows = ledger.repository(ChatExecutionEntity);
        await rows.save(execution());

        await expect(rows.save(execution({ id: "exec-2" }))).rejects.toThrow();
    });

    // 색인이 running 에만 걸리므로 끝난 실행은 몇 개든 남는다.
    it("끝난 실행은 같은 스레드에 여럿 남는다", async () => {
        const rows = ledger.repository(ChatExecutionEntity);
        await rows.save(execution({ status: CHAT_EXECUTION_STATUS.completed }));

        await expect(
            rows.save(execution({ id: "exec-2", status: CHAT_EXECUTION_STATUS.completed })),
        ).resolves.toBeDefined();
    });

    // 잠금은 스레드마다이므로 다른 스레드의 running 은 서로를 막지 않는다.
    it("다른 스레드의 running 은 서로를 막지 않는다", async () => {
        const rows = ledger.repository(ChatExecutionEntity);
        await rows.save(execution());

        await expect(
            rows.save(execution({ id: "exec-2", threadId: "thread-2" })),
        ).resolves.toBeDefined();
    });

    // 축을 가리지 않고 세므로 상대 축이 실행 중이면 이 축도 가져가지 못한다.
    it("축이 달라도 같은 스레드의 running 은 하나다", async () => {
        const rows = ledger.repository(ChatExecutionEntity);
        await rows.save(execution());

        await expect(
            rows.save(execution({ id: "exec-2", requestedBackend: "python" })),
        ).rejects.toThrow();
    });
});
