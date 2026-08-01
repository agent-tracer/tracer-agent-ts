import { describe, expect, it } from "vitest";
import type { AgentQueryRequest } from "~llm/runner/llm.runner.js";
import { createClaudeRunTree } from "./claude.trace.js";
import type { ClaudeQueryOptions } from "./claude.query.options.js";

function request(
    overrides: Partial<AgentQueryRequest<ClaudeQueryOptions>> = {},
): AgentQueryRequest<ClaudeQueryOptions> {
    return {
        label: "test-agent",
        prompt: "system prompt",
        systemPrompt: "",
        allowedTools: [],
        model: "claude-3-5-sonnet",
        maxTurns: 1,
        deadlineMs: 1000,
        env: {},
        ...overrides,
    };
}

describe("추적 루트의 메타데이터", () => {
    it("실행을 잇는 식별자를 전부 메타데이터로 싣는다", async () => {
        process.env.LANGSMITH_TRACING = "true";

        const runTree = await createClaudeRunTree(request({
            observation: {
                executionId: "exec-1",
                attemptId: "exec-1:1",
                promptVersion: "v1.0",
                toolContractVersion: "v2",
            },
            jobId: "job-1",
        }), false);

        expect(runTree).not.toBeNull();
        expect(runTree?.name).toBe("test-agent");
        expect(runTree?.extra.metadata).toEqual({
            "agent_tracer.agent.name": "test-agent",
            "agent_tracer.backend": "typescript",
            "agent_tracer.model.requested": "claude-3-5-sonnet",
            "agent_tracer.prompt.version": "v1.0",
            "agent_tracer.tool.contract.version": "v2",
            "agent_tracer.job.id": "job-1",
            "agent_tracer.execution.id": "exec-1",
            "agent_tracer.attempt.id": "exec-1:1",
        });
    });

    it("추적이 꺼져 있으면 루트를 만들지 않는다", async () => {
        process.env.LANGSMITH_TRACING = "false";
        const runTree = await createClaudeRunTree(request({ label: "test" }), false);
        expect(runTree).toBeNull();
    });
});
