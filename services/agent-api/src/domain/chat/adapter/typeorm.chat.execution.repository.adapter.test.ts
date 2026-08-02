import { AGENT_BACKEND } from "@tracer-agent/llm";
import type { FindManyOptions, FindOptionsWhere, Repository } from "typeorm";
import { describe, expect, it } from "vitest";
import type { ChatExecutionEntity } from "./chat.execution.entity.js";
import { TypeOrmChatExecutionRepository } from "./typeorm.chat.execution.repository.adapter.js";

/** 조회가 세우는 where 만 모으고 결과는 언제나 비어 있는 것으로 답한다. */
function capturingRepository(): {
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
    it("살아 있는 실행을 모을 때 자기 축만 조회한다", async () => {
        const { finds, repo } = capturingRepository();

        await new TypeOrmChatExecutionRepository(repo).listActive();

        expect(finds[0]?.requestedBackend).toBe(AGENT_BACKEND);
    });

    it("멈춘 실행을 되돌릴 때 자기 축만 조회한다", async () => {
        const { updates, repo } = capturingRepository();

        await new TypeOrmChatExecutionRepository(repo).recoverStaleRunning(new Date(), new Date());

        expect(updates[0]?.requestedBackend).toBe(AGENT_BACKEND);
    });
});
