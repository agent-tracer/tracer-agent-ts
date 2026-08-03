import path from "node:path";
import { AGENT_BACKEND } from "@tracer-agent/llm";
import { CONTRACT_ROOT, readContractJson } from "~agent-worker/support/contract.js";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ChatExecutionSpend } from "~agent-worker/domain/chat/model/chat.execution.model.js";
import { AgentRunObservationEntity } from "~agent-worker/config/ledger/agent.run.observation.entity.js";
import { ChatExecutionEntity } from "./chat.entity.js";
import { TypeOrmChatExecutionRepository } from "./typeorm.chat.execution.repository.adapter.js";

interface ContractCase {
    readonly name: string;
    readonly given: readonly Record<string, unknown>[];
    readonly call: Record<string, unknown>;
    readonly expect: {
        readonly result: unknown;
        readonly rows: readonly Record<string, unknown>[];
    };
}

interface ContractOperation {
    readonly operation: string;
    readonly cases: readonly ContractCase[];
}

interface ChatCases {
    readonly cases: {
        readonly row: Record<string, string>;
        readonly spend: Record<string, unknown>;
        readonly operations: readonly ContractOperation[];
    };
}

const { cases: contract } = readContractJson<ChatCases>("agent/chat/cases.json");

/** 이 배포 단위가 소유한 창구이며 나머지는 agent-api 가 같은 케이스로 판정한다. */
const OWNED = new Set([
    "recoverStaleRunning",
    "claimQueued",
    "beginAttempt",
    "checkpointRunning",
    "completeRunning",
    "recordCanceledOutcome",
    "failActive",
]);

const DATE_KEYS = new Set(["createdAt", "updatedAt", "startedAt", "completedAt"]);
// 관측이 종결의 정본이므로 running 에서 접는 케이스는 그 관측을 먼저 심는다.
const OBSERVED_STATUS: Record<string, string> = {
    completeRunning: "succeeded",
    failActive: "failed",
};

let ledger: StartedLedger;

beforeAll(async () => {
    ledger = await startLedger(path.join(CONTRACT_ROOT, "db", "migrations"), [
        ChatExecutionEntity,
        AgentRunObservationEntity,
    ]);
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
});

function seedRow(caseRow: Record<string, unknown>): Record<string, unknown> {
    const id = String(caseRow["id"]);
    const row: Record<string, unknown> = {
        id,
        replayAnchorMessageId: `message-${id}`,
        clientRequestId: `request-${id}`,
        inputHash: `hash-${id}`,
        status: "queued",
        requestedBackend: AGENT_BACKEND,
    };
    for (const source of [contract.row, caseRow]) {
        for (const [key, value] of Object.entries(source)) {
            if (key === "id") continue;
            row[key] = DATE_KEYS.has(key) && value !== null ? new Date(value as string) : value;
        }
    }
    return row;
}

function spend(): ChatExecutionSpend {
    return contract.spend as unknown as ChatExecutionSpend;
}

function invoke(
    repository: TypeOrmChatExecutionRepository,
    operation: string,
    call: Record<string, unknown>,
): Promise<unknown> {
    const now = new Date(String(call["now"]));
    const id = typeof call["id"] === "string" ? call["id"] : "";
    switch (operation) {
        case "recoverStaleRunning":
            return repository.recoverStaleRunning(
                new Date(String(call["idleBefore"])),
                now,
                typeof call["threadId"] === "string" ? call["threadId"] : undefined,
            );
        case "claimQueued":
            return repository.claimQueued(id, now);
        case "beginAttempt":
            return repository.beginAttempt(id, Number(call["attempt"]), String(call["draftTokenHash"]), now);
        case "checkpointRunning":
            return repository.checkpointRunning(
                id,
                Number(call["attempt"]),
                String(call["draftText"]),
                Number(call["draftSeq"]),
                now,
            );
        case "completeRunning":
            return repository.completeRunning(id, String(call["assistantMessageId"]), spend(), now);
        case "recordCanceledOutcome":
            return repository.recordCanceledOutcome(id, String(call["assistantMessageId"]), spend(), now);
        case "failActive":
            return repository.failActive(id, String(call["error"]), now);
        default:
            throw new Error(`계약 케이스가 이 배포 단위가 모르는 연산을 부른다: ${operation}`);
    }
}

function observationRow(status: string): Record<string, unknown> {
    return {
        executionId: "e1",
        attemptId: "1",
        userId: "u1",
        agentName: "chat",
        backend: AGENT_BACKEND,
        modelRequested: "model",
        promptVersion: "1.0.0",
        toolContractVersion: "1.0.0",
        status,
        durationMs: 1,
        usage: {},
        landed: false,
        repairAttempted: false,
        validation: {},
        modelCalls: [],
        toolCalls: [],
        createdAt: new Date("2026-07-26T00:00:00.000Z"),
    };
}

function wire(value: unknown): unknown {
    return value instanceof Date ? `${value.toISOString().slice(0, 23)}Z` : value;
}

describe("대화 실행 상태 기계", () => {
    for (const operation of contract.operations.filter((one) => OWNED.has(one.operation))) {
        for (const one of operation.cases) {
            it(`${operation.operation}: ${one.name}`, async () => {
                const executions = ledger.repository(ChatExecutionEntity);
                await executions.insert(one.given.map(seedRow));
                const observed = OBSERVED_STATUS[operation.operation];
                if (observed !== undefined && one.given.some((row) => row["status"] === "running")) {
                    await ledger.repository(AgentRunObservationEntity).insert(observationRow(observed));
                }
                const repository = new TypeOrmChatExecutionRepository(executions);

                const result = await invoke(repository, operation.operation, one.call);

                const rows = [];
                for (const expected of one.expect.rows) {
                    const stored = await executions.findOneOrFail({ where: { id: String(expected["id"]) } });
                    rows.push(
                        Object.fromEntries(
                            Object.keys(expected).map((key) => [key, wire((stored as unknown as Record<string, unknown>)[key])]),
                        ),
                    );
                }
                expect({ result, rows }).toEqual(one.expect);
            });
        }
    }
});
