import path from "node:path";
import { AGENT_BACKEND } from "@tracer-agent/llm";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTRACT_ROOT, readContractJson } from "~agent-api/support/contract.js";
import { ChatExecutionEntity } from "./chat.execution.entity.js";
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

interface ChatCases {
    readonly cases: {
        readonly row: Record<string, string>;
        readonly operations: readonly {
            readonly operation: string;
            readonly cases: readonly ContractCase[];
        }[];
    };
}

const { cases: contract } = readContractJson<ChatCases>("agent/chat/cases.json");

/** 이 배포 단위가 소유한 창구이며 나머지는 agent-worker 가 같은 케이스로 판정한다. */
const OWNED = new Set(["cancelActive"]);

const DATE_KEYS = new Set(["createdAt", "updatedAt", "startedAt", "completedAt"]);

let ledger: StartedLedger;

beforeAll(async () => {
    ledger = await startLedger(path.join(CONTRACT_ROOT, "db", "migrations"), [ChatExecutionEntity]);
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
    // 관측 원장은 이 배포 단위의 엔티티가 아니지만 취소 판정이 그 표를 읽으므로 함께 비운다.
    await ledger.source.query('TRUNCATE "agent_run_observations"');
});

function seedRow(caseRow: Record<string, unknown>): Record<string, unknown> {
    const id = String(caseRow["id"]);
    const row: Record<string, unknown> = {
        id,
        userMessageId: `message-${id}`,
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

function wire(value: unknown): unknown {
    return value instanceof Date ? `${value.toISOString().slice(0, 23)}Z` : value;
}

describe("대화 실행 취소 판정", () => {
    for (const operation of contract.operations.filter((one) => OWNED.has(one.operation))) {
        for (const one of operation.cases) {
            it(`${operation.operation}: ${one.name}`, async () => {
                const executions = ledger.repository(ChatExecutionEntity);
                await executions.insert(one.given.map(seedRow));
                const repository = new TypeOrmChatExecutionRepository(executions);

                const result = await repository.cancelActive(
                    String(one.call["id"]),
                    new Date(String(one.call["now"])),
                );

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
