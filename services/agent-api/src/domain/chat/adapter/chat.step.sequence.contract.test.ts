import path from "node:path";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTRACT_ROOT } from "~agent-api/support/contract.js";
import { ChatExecutionStepEntity } from "./chat.execution.step.entity.js";

/** 어느 색인이 거절했는지까지 보지 않으면 다른 색인이 먼저 걸린 것을 이 색인의 거절로 읽는다. */
const CONSTRAINT = "chat_execution_steps_execution_attempt_seq";

let ledger: StartedLedger;

function refusedBy(error: unknown): string | undefined {
    return (error as { driverError?: { constraint?: string } }).driverError?.constraint;
}

function step(overrides: Partial<ChatExecutionStepEntity> = {}): ChatExecutionStepEntity {
    const row = new ChatExecutionStepEntity();
    row.id = "step-1";
    row.executionId = "exec-1";
    row.userId = "user-1";
    row.attempt = 1;
    row.seq = 1;
    row.role = "assistant";
    row.content = "무엇을 했는지";
    row.truncated = false;
    row.createdAt = new Date("2026-01-01T00:00:00Z");
    return Object.assign(row, overrides);
}

beforeAll(async () => {
    ledger = await startLedger(path.join(CONTRACT_ROOT, "db", "migrations"), [ChatExecutionStepEntity]);
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
});

describe("한 시도 안에서 궤적의 순번은 하나다", () => {
    it("같은 실행과 시도와 순번의 두 번째 단계를 거절한다", async () => {
        const rows = ledger.repository(ChatExecutionStepEntity);
        await rows.save(step());

        await expect(rows.save(step({ id: "step-2" }))).rejects.toSatisfy(
            (error: unknown) => refusedBy(error) === CONSTRAINT,
        );
    });

    // 거절만 보면 색인이 좁아져도 통과하므로 다시 실행한 시도가 같은 순번을 받는 것을 함께 본다.
    it("다시 실행한 시도는 같은 순번을 다시 적는다", async () => {
        const rows = ledger.repository(ChatExecutionStepEntity);
        await rows.save(step());

        await expect(rows.save(step({ id: "step-2", attempt: 2 }))).resolves.toBeDefined();
    });

    it("같은 시도의 다음 순번은 받는다", async () => {
        const rows = ledger.repository(ChatExecutionStepEntity);
        await rows.save(step());

        await expect(rows.save(step({ id: "step-2", seq: 2 }))).resolves.toBeDefined();
    });

    it("다른 실행은 같은 시도와 순번을 쓴다", async () => {
        const rows = ledger.repository(ChatExecutionStepEntity);
        await rows.save(step());

        await expect(rows.save(step({ id: "step-2", executionId: "exec-2" }))).resolves.toBeDefined();
    });
});
