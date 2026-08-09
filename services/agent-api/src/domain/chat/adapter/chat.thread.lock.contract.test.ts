import path from "node:path";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CHAT_EXECUTION_STATUS } from "~agent-api/domain/chat/model/chat.const.js";
import { CONTRACT_ROOT } from "~agent-api/support/contract.js";
import { ChatExecutionEntity } from "./chat.execution.entity.js";

/** 어느 제약이 거절했는지까지 보지 않으면 다른 색인이 먼저 걸린 것을 이 제약의 거절로 읽는다. */
const CONSTRAINT = "chat_executions_running_thread";

function refusedBy(error: unknown): string | undefined {
    return (error as { driverError?: { constraint?: string } }).driverError?.constraint;
}

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

        await expect(rows.save(execution({ id: "exec-2" }))).rejects.toSatisfy(
            (error: unknown) => refusedBy(error) === CONSTRAINT,
        );
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
        ).rejects.toSatisfy((error: unknown) => refusedBy(error) === CONSTRAINT);
    });
});

describe("접수가 적는 축은 계약이 아는 둘뿐이다", () => {
    // 상류가 실어 보낸 값을 옮겨 적으면 원장에 모르는 축이 들어오므로 원장이 그 자리를 막는다.
    it("계약이 모르는 축을 거절한다", async () => {
        const rows = ledger.repository(ChatExecutionEntity);

        await expect(
            rows.save(execution({ requestedBackend: "rust" })),
        ).rejects.toSatisfy(
            (error: unknown) => refusedBy(error) === "chat_executions_requested_backend_check",
        );
    });

    it.each(["ts", "python"])("%s 는 받는다", async (axis) => {
        const rows = ledger.repository(ChatExecutionEntity);

        await expect(
            rows.save(execution({ id: `exec-${axis}`, requestedBackend: axis })),
        ).resolves.toBeDefined();
    });

    // 아직 축이 정해지지 않은 행이 있으므로 빈 값은 막지 않는다.
    it("축이 비어 있는 행은 받는다", async () => {
        const rows = ledger.repository(ChatExecutionEntity);

        await expect(
            rows.save(execution({ requestedBackend: null })),
        ).resolves.toBeDefined();
    });
});
