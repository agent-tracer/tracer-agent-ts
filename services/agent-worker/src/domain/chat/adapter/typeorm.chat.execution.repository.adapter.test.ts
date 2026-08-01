import type { Repository } from "typeorm";
import { describe, expect, it } from "vitest";
import type { ChatExecutionEntity } from "./chat.entity.js";
import { TypeOrmChatExecutionRepository } from "./typeorm.chat.execution.repository.adapter.js";

/** 갱신 질의가 세우는 조건만 모으고 실행은 언제나 한 행을 바꾼 것으로 답한다. */
function capturingRepository(): { conditions: string[]; repo: Repository<ChatExecutionEntity> } {
    const conditions: string[] = [];
    const builder = {
        update: () => builder,
        set: () => builder,
        where: () => builder,
        andWhere: (condition: string) => {
            conditions.push(condition);
            return builder;
        },
        execute: () => Promise.resolve({ affected: 1 }),
    };
    return {
        conditions,
        repo: { createQueryBuilder: () => builder } as unknown as Repository<ChatExecutionEntity>,
    };
}

function observedBranch(conditions: string[]): string {
    const found = conditions.find((condition) => condition.includes("agent_run_observations"));
    if (found === undefined) throw new Error("관측을 보는 조건이 없다");
    return found;
}

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
        const { conditions, repo } = capturingRepository();

        await new TypeOrmChatExecutionRepository(repo).failActive("execution", "이유", new Date());

        expect(observedBranch(conditions)).toContain("status = :settled OR");
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
