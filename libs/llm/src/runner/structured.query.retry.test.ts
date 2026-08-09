import { describe, expect, it } from "vitest";
import { z } from "zod";
import { loadExecutionBudgetContract } from "~llm/model/execution.budget.schema.js";
import { runStructuredQuery, type RetryPacer } from "./structured.query.js";
import type { AgentQueryResult, AgentQueryRequest, IQueryRunner } from "./llm.runner.js";

const RETRY = loadExecutionBudgetContract().runnerRetry;
const SCHEMA = z.object({ answer: z.string().min(1) });
const GOOD = { answer: "ok" };
const BAD = { answer: "" };

/** 기다림을 재는 대역이며 실물이 지우는 것은 벽시계뿐이고 흔들림은 늘 가운데 값을 쓴다. */
const PACER: RetryPacer & { waited: number[] } = {
    waited: [],
    wait(ms) {
        this.waited.push(ms);
        return Promise.resolve();
    },
    jitter: () => 0.5,
};

function result(overrides: Partial<AgentQueryResult> = {}): AgentQueryResult {
    return {
        rawOutput: JSON.stringify(GOOD),
        structuredOutput: GOOD,
        durationMs: 1,
        numTurns: 1,
        costUsd: 0.01,
        usage: null,
        steps: [],
        errorSummary: null,
        errorSubtype: null,
        landed: false,
        actualModel: "claude-haiku-4-5",
        providerRequestId: null,
        ttftMs: null,
        startupMs: null,
        ...overrides,
    };
}

/** 준 순서대로 내주고 다 쓰면 마지막 것을 되풀이하는 실행기 대역이다. */
class ScriptedRunner implements IQueryRunner {
    readonly prompts: string[] = [];

    constructor(private readonly script: readonly AgentQueryResult[]) {}

    requiresLocalApiKey(): boolean {
        return false;
    }

    run(request: AgentQueryRequest): Promise<AgentQueryResult> {
        const next = this.script[Math.min(this.prompts.length, this.script.length - 1)]!;
        this.prompts.push(request.prompt);
        return Promise.resolve(next);
    }
}

const REQUEST = { label: "test", prompt: "물음", model: "claude-haiku-4-5" } as AgentQueryRequest;

function ask(runner: ScriptedRunner): Promise<{ costUsd: number | null; numTurns: number | null }> {
    PACER.waited.length = 0;
    return runStructuredQuery(runner, REQUEST, SCHEMA, PACER);
}

// 산출을 함께 낸 실패는 그 산출이 스키마를 넘기면 성공으로 보내므로 실패 대역은 산출을 비운다.
const TRANSIENT = result({
    rawOutput: "",
    structuredOutput: null,
    errorSummary: "overloaded",
    errorSubtype: "overloaded_error",
});
const REJECTED = result({ rawOutput: JSON.stringify(BAD), structuredOutput: BAD });

describe("공급자가 잠시 받지 못한 실패", () => {
    it("계약이 적은 횟수만큼 다시 부른다", async () => {
        const runner = new ScriptedRunner([TRANSIENT]);

        await expect(ask(runner)).rejects.toThrow();
        expect(runner.prompts).toHaveLength(1 + RETRY.transient.attempts);
    });

    it("다시 부른 호출이 성공하면 거기서 멈춘다", async () => {
        const runner = new ScriptedRunner([TRANSIENT, result()]);

        await ask(runner);

        expect(runner.prompts).toHaveLength(2);
    });

    // 판정이 없는 실패까지 다시 부르면 못 고칠 실패에 값을 세 번 지불한다.
    it("재시도 판정이 없는 실패는 다시 부르지 않는다", async () => {
        const runner = new ScriptedRunner([
            result({ rawOutput: "", structuredOutput: null, errorSummary: "거절", errorSubtype: "refusal" }),
        ]);

        await expect(ask(runner)).rejects.toThrow();
        expect(runner.prompts).toHaveLength(1);
    });

    it("물러섬이 계약이 적은 간격에서 시작해 배수로 자란다", async () => {
        const runner = new ScriptedRunner([TRANSIENT]);

        await expect(ask(runner)).rejects.toThrow();

        const { initialDelayMs, backoffFactor } = RETRY.transient;
        expect(PACER.waited).toEqual([
            Math.round(initialDelayMs * 0.75),
            Math.round(initialDelayMs * backoffFactor * 0.75),
        ]);
    });
});

describe("모델이 규격을 어긴 산출", () => {
    it("계약이 적은 횟수만큼 되받는다", async () => {
        const runner = new ScriptedRunner([REJECTED]);

        await expect(ask(runner)).rejects.toThrow();
        expect(runner.prompts).toHaveLength(1 + RETRY.schemaViolation.attempts);
    });

    it("되받는 호출에 계약이 적은 지시를 덧붙인다", async () => {
        const runner = new ScriptedRunner([REJECTED, result()]);

        await ask(runner);

        expect(runner.prompts[1]).toContain(RETRY.schemaViolation.directive);
    });

    it("되받은 산출이 통과하면 그것을 낸다", async () => {
        const runner = new ScriptedRunner([REJECTED, result()]);

        await expect(ask(runner)).resolves.toMatchObject({ data: GOOD });
    });
});

describe("여러 번 부른 호출의 장부", () => {
    // 더하지 않으면 예산이 지불한 것보다 적게 세어 상한이 늦게 걸린다.
    it("다시 부른 호출의 비용과 턴을 함께 센다", async () => {
        const runner = new ScriptedRunner([REJECTED, result()]);

        await expect(ask(runner)).resolves.toMatchObject({ costUsd: 0.02, numTurns: 2 });
    });

    it("한 번에 끝나면 그 호출의 값만 센다", async () => {
        const runner = new ScriptedRunner([result()]);

        await expect(ask(runner)).resolves.toMatchObject({ costUsd: 0.01, numTurns: 1 });
    });
});
