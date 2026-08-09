import { AGENT_BACKEND } from "@tracer-agent/llm";
import type { FindManyOptions, FindOptionsWhere, Repository } from "typeorm";
import { describe, expect, it } from "vitest";
import { CHAT_EXECUTION_STATUS } from "~agent-worker/domain/chat/model/chat.const.js";
import type { ChatExecutionEntity } from "./chat.entity.js";
import { TypeOrmChatExecutionRepository } from "./typeorm.chat.execution.repository.adapter.js";

/** 갱신 질의가 세우는 조건과 그 조건에 묶은 값을 모으고 실행은 언제나 한 행을 바꾼 것으로 답한다. */
function capturingRepository(): {
    conditions: string[];
    parameters: Record<string, unknown>;
    repo: Repository<ChatExecutionEntity>;
} {
    const conditions: string[] = [];
    const parameters: Record<string, unknown> = {};
    const builder = {
        update: () => builder,
        set: () => builder,
        where: () => builder,
        andWhere: (condition: string, bound?: Record<string, unknown>) => {
            conditions.push(condition);
            Object.assign(parameters, bound ?? {});
            return builder;
        },
        execute: () => Promise.resolve({ affected: 1 }),
    };
    return {
        conditions,
        parameters,
        repo: { createQueryBuilder: () => builder } as unknown as Repository<ChatExecutionEntity>,
    };
}

function observedBranch(conditions: string[]): string {
    const found = conditions.find((condition) => condition.includes("agent_run_observations"));
    if (found === undefined) throw new Error("관측을 보는 조건이 없다");
    return found;
}

/** 조회가 세우는 where 만 모으고 결과는 언제나 비어 있는 것으로 답한다. */
function whereCapturingRepository(): {
    finds: FindOptionsWhere<ChatExecutionEntity>[];
    updates: FindOptionsWhere<ChatExecutionEntity>[];
    repo: Repository<ChatExecutionEntity>;
} {
    const finds: FindOptionsWhere<ChatExecutionEntity>[] = [];
    const updates: FindOptionsWhere<ChatExecutionEntity>[] = [];
    const repo = {
        find: (options: FindManyOptions<ChatExecutionEntity>) => {
            finds.push(options.where as FindOptionsWhere<ChatExecutionEntity>);
            return Promise.resolve([]);
        },
        update: (where: FindOptionsWhere<ChatExecutionEntity>) => {
            updates.push(where);
            return Promise.resolve({ affected: 0 });
        },
    } as unknown as Repository<ChatExecutionEntity>;
    return { finds, updates, repo };
}

describe("실행 원장의 축 조건", () => {
    it("스레드의 대기 실행을 모을 때 자기 축만 조회한다", async () => {
        const { finds, repo } = whereCapturingRepository();

        await new TypeOrmChatExecutionRepository(repo).listQueuedByThread("thread");

        expect(finds[0]?.requestedBackend).toBe(AGENT_BACKEND);
    });

    it("멈춘 실행을 되돌릴 때 자기 축만 조회한다", async () => {
        const { updates, repo } = whereCapturingRepository();

        await new TypeOrmChatExecutionRepository(repo).recoverStaleRunning(new Date(), new Date());

        expect(updates[0]?.requestedBackend).toBe(AGENT_BACKEND);
    });
});

describe("실행을 종결로 접는 조건", () => {
    it("관측이 같은 종결을 새긴 running 행을 접는다", async () => {
        const { conditions, repo } = capturingRepository();

        await new TypeOrmChatExecutionRepository(repo).failActive("execution", "이유", new Date());

        expect(observedBranch(conditions)).toContain("observation.status = 'failed'");
    });

    it("관측이 하나도 없는 running 행도 접는다", async () => {
        const { conditions, repo } = capturingRepository();

        await new TypeOrmChatExecutionRepository(repo).failActive("execution", "이유", new Date());

        expect(observedBranch(conditions)).toContain("NOT EXISTS");
    });

    it("아직 시작하지 않은 실행은 관측을 보지 않고 접는다", async () => {
        const { conditions, parameters, repo } = capturingRepository();

        await new TypeOrmChatExecutionRepository(repo).failActive("execution", "이유", new Date());

        expect(observedBranch(conditions)).toContain("status = :notStarted OR");
        expect(parameters["notStarted"]).toBe(CHAT_EXECUTION_STATUS.queued);
    });

    it("이미 접힌 행에 산출물을 붙이는 길은 종결된 상태를 그 이름으로 묶는다", async () => {
        const { parameters, repo } = capturingRepository();

        await new TypeOrmChatExecutionRepository(repo).recordCanceledOutcome(
            "execution",
            "message",
            { modelUsed: "model", costUsd: 0, numTurns: 1, stopReason: "canceled", usage: {} },
            new Date(),
        );

        expect(parameters["settled"]).toBe(CHAT_EXECUTION_STATUS.canceled);
    });

    it("이미 접힌 행에 산출물을 붙이는 길은 관측을 그대로 요구한다", async () => {
        const { conditions, repo } = capturingRepository();

        await new TypeOrmChatExecutionRepository(repo).recordCanceledOutcome(
            "execution",
            "message",
            { modelUsed: "model", costUsd: 0, numTurns: 1, stopReason: "canceled", usage: {} },
            new Date(),
        );

        expect(observedBranch(conditions)).toContain("observation.status = 'cancelled'");
        expect(observedBranch(conditions)).not.toContain("NOT EXISTS");
    });
});
