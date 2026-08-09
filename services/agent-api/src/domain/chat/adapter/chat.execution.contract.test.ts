import path from "node:path";
import { AGENT_BACKEND } from "@tracer-agent/llm";
import { LedgerUniqueViolationError } from "@tracer-agent/platform";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
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

/** 번역한 오류가 원인을 그대로 들고 있으므로 어느 제약이 거절했는지는 그 사슬 안쪽이 안다. */
function refusedBy(error: unknown): string | undefined {
    const cause = (error as { cause?: unknown }).cause;
    return (cause as { driverError?: { constraint?: string } } | undefined)?.driverError?.constraint;
}

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

function wire(value: unknown): unknown {
    return value instanceof Date ? `${value.toISOString().slice(0, 23)}Z` : value;
}

describe("실행 원장의 멱등 제약", () => {
    function turn(id: string): ChatExecution {
        return ChatExecution.create({
            id,
            userId: "local",
            threadId: "t1",
            replayAnchorMessageId: `message-${id}`,
            clientRequestId: "r1",
            inputHash: "hash-1",
            model: null,
            language: null,
            now: new Date("2026-01-01T00:00:00.000Z"),
        });
    }

    it("같은 멱등 좌표의 두 번째 접수를 드라이버 오류가 아니라 중복으로 알린다", async () => {
        const repository = new TypeOrmChatExecutionRepository(ledger.repository(ChatExecutionEntity));
        await repository.insert(turn("execution-1"));

        await expect(repository.insert(turn("execution-2")))
            .rejects.toBeInstanceOf(LedgerUniqueViolationError);
    });

    // 어느 색인이 거절했는지까지 보지 않으면 다른 유일 색인이 먼저 걸린 것을 이 색인의 거절로 읽는다.
    it("거절한 색인이 멱등 좌표의 색인이다", async () => {
        const repository = new TypeOrmChatExecutionRepository(ledger.repository(ChatExecutionEntity));
        await repository.insert(turn("execution-1"));

        await expect(repository.insert(turn("execution-2"))).rejects.toSatisfy(
            (error: unknown) => refusedBy(error) === "chat_executions_idempotency",
        );
    });

    it("멱등 좌표가 다르면 그대로 적는다", async () => {
        const repository = new TypeOrmChatExecutionRepository(ledger.repository(ChatExecutionEntity));
        await repository.insert(turn("execution-1"));

        await expect(repository.insert(
            ChatExecution.create({
                id: "execution-2",
                userId: "local",
                threadId: "t1",
                replayAnchorMessageId: "message-2",
                clientRequestId: "r2",
                inputHash: "hash-2",
                model: null,
                language: null,
                now: new Date("2026-01-01T00:00:00.000Z"),
            }),
        )).resolves.toBeUndefined();
    });
});

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
