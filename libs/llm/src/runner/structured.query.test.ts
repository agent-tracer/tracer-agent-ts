import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { AgentQueryRequest, AgentQueryResult, IQueryRunner } from "./llm.runner.js";
import { runStructuredQuery } from "./structured.query.js";

const schema = z.object({ title: z.string() });

const REQUEST: AgentQueryRequest = {
    label: "test-agent",
    prompt: "go",
    systemPrompt: "system",
    allowedTools: [],
    model: "claude-sonnet-4-6",
    maxTurns: 10,
    deadlineMs: 1000,
    env: {},
};

function result(overrides: Partial<AgentQueryResult>): AgentQueryResult {
    return {
        rawOutput: "",
        structuredOutput: null,
        durationMs: 1,
        numTurns: 1,
        costUsd: 0,
        usage: null,
        steps: [],
        errorSummary: null,
        errorSubtype: null,
        landed: false,
        actualModel: "claude-sonnet-4-6",
        providerRequestId: null,
        ...overrides,
    };
}

class FakeRunner implements IQueryRunner {
    constructor(private readonly response: AgentQueryResult) {}

    requiresLocalApiKey(): boolean {
        return false;
    }

    async run(): Promise<AgentQueryResult> {
        return this.response;
    }
}

describe("runStructuredQuery", () => {
    it("errorSummary가 없고 구조화 출력이 스키마를 통과하면 성공한다", async () => {
        const runner = new FakeRunner(result({ structuredOutput: { title: "제목" } }));

        const output = await runStructuredQuery(runner, REQUEST, schema);

        expect(output.data).toEqual({ title: "제목" });
    });

    it("예산이나 턴이 소진돼도 착지가 받아낸 출력이 스키마를 통과하면 성공한다", async () => {
        const runner = new FakeRunner(
            result({ errorSummary: "error_max_turns", structuredOutput: { title: "제목" } }),
        );

        const output = await runStructuredQuery(runner, REQUEST, schema);

        expect(output.data).toEqual({ title: "제목" });
    });

    it("errorSummary가 있고 유효한 출력도 없으면 AGENT_FAILED를 던진다", async () => {
        const runner = new FakeRunner(result({ errorSummary: "error_max_turns" }));

        await expect(runStructuredQuery(runner, REQUEST, schema)).rejects.toMatchObject(
            expect.objectContaining({ code: "AGENT_FAILED" }) as object,
        );
    });

    it("출력이 전혀 없으면 errorSummary가 없어도 AGENT_FAILED를 던진다", async () => {
        const runner = new FakeRunner(result({}));

        await expect(runStructuredQuery(runner, REQUEST, schema)).rejects.toMatchObject(
            expect.objectContaining({ code: "AGENT_FAILED" }) as object,
        );
    });

    it("errorSummary가 없고 rawOutput이 JSON으로 파싱되지 않으면 OUTPUT_NOT_JSON을 던진다", async () => {
        const runner = new FakeRunner(result({ rawOutput: "not json" }));

        await expect(runStructuredQuery(runner, REQUEST, schema)).rejects.toMatchObject(
            expect.objectContaining({ code: "OUTPUT_NOT_JSON" }) as object,
        );
    });

    it("errorSummary가 없고 구조화 출력이 스키마를 어기면 OUTPUT_SCHEMA_INVALID를 던진다", async () => {
        const runner = new FakeRunner(result({ structuredOutput: { title: 42 } }));

        await expect(runStructuredQuery(runner, REQUEST, schema)).rejects.toMatchObject(
            expect.objectContaining({ code: "OUTPUT_SCHEMA_INVALID" }) as object,
        );
    });
});
