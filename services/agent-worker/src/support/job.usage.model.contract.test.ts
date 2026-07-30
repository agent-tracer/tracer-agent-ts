import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runStructuredQuery, type AgentQueryRequest, type AgentQueryResult, type IQueryRunner } from "@tracer-agent/llm";
import { readJobUsageModelRule } from "~agent-worker/support/contract.js";

const schema = z.object({ title: z.string() });

class FixedRunner implements IQueryRunner {
    constructor(private readonly actualModel: string) {}

    requiresLocalApiKey(): boolean {
        return false;
    }

    run(): Promise<AgentQueryResult> {
        return Promise.resolve({
            rawOutput: "",
            structuredOutput: { title: "제목" },
            durationMs: 1,
            numTurns: 1,
            costUsd: 0,
            usage: null,
            steps: [],
            errorSummary: null,
            errorSubtype: null,
            landed: false,
            actualModel: this.actualModel,
            providerRequestId: null,
        });
    }
}

describe("잡 사용량의 모델 식별자", () => {
    it("계약이 적은 별칭을 적고 판까지 붙은 식별자를 적지 않는다", async () => {
        const rule = readJobUsageModelRule();
        const request: AgentQueryRequest = {
            label: "test-agent",
            prompt: "go",
            systemPrompt: "system",
            allowedTools: [],
            model: rule.example,
            maxTurns: 10,
            deadlineMs: 1000,
            env: {},
        };

        const response = await runStructuredQuery(new FixedRunner(rule.forbidden), request, schema);

        expect(response.modelUsed).toBe(rule.example);
        expect(response.modelUsed).not.toBe(rule.forbidden);
    });
});
