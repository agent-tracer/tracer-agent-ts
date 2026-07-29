import { AgentExecutionFailure, type ResolvedAgentPrompt } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { OUTPUT_LANGUAGE } from "~agent-worker/support/output.language.js";
import {
    attemptRun,
    candidate,
    cleanupIds,
    emptyOutput,
    FakeCleanupAgent,
    fixedClock,
    seedRepository,
} from "../port/__fakes__/cleanup.test-support.js";
import type { TaskCleanupPrep } from "./prepare.task.cleanup.usecase.js";
import { SuggestCleanupUsecase } from "./suggest.cleanup.usecase.js";

const PROMPT: ResolvedAgentPrompt = {
    versionId: "v1",
    semanticVersion: "1.0.0",
    contentHash: "mock-hash",
    toolContractVersion: "v1",
    outputSchemaVersion: "v1",
};

function prep(overrides: Partial<TaskCleanupPrep> = {}): TaskCleanupPrep {
    return {
        jobId: "job-1",
        userId: "user-1",
        language: OUTPUT_LANGUAGE.ko,
        maxSuggestions: 20,
        candidates: [candidate()],
        truncated: false,
        tasksScanned: 2,
        prompt: PROMPT,
        ...overrides,
    };
}

describe("SuggestCleanupUsecase", () => {
    it("후보 목록에 없는 제안을 걷어낸다", async () => {
        const repository = seedRepository();
        const agent = new FakeCleanupAgent(emptyOutput({
            suggestions: [
                { kind: "archive", taskId: "task-1", rationale: "근거", evidenceEventIds: [] },
                { kind: "archive", taskId: "ghost", rationale: "근거", evidenceEventIds: [] },
            ],
        }));
        const target = new SuggestCleanupUsecase(repository, agent, fixedClock, cleanupIds());

        const output = await target.execute(prep(), attemptRun());

        expect(output.suggestions.map((suggestion) => suggestion.taskId)).toEqual(["task-1"]);
        expect(agent.calls[0]?.apiKey).toBe("sk-test");
    });

    it("에이전트 실패의 비용과 궤적을 남기고 오류를 다시 던진다", async () => {
        const repository = seedRepository();
        const agent = new FakeCleanupAgent(emptyOutput());
        agent.failure = new AgentExecutionFailure("task-cleanup", "AGENT_FAILED", "rate limited", {
            errorSubtype: "rate_limit_error",
            usage: { inputTokens: 4, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 },
            actualModel: "claude-haiku-4-5",
            durationMs: 500,
        });
        const target = new SuggestCleanupUsecase(repository, agent, fixedClock, cleanupIds());

        await expect(target.execute(prep(), attemptRun(2))).rejects.toThrow("rate limited");
        expect(repository.failedAttempts[0]?.record).toMatchObject({
            attempt: 2,
            status: "failed",
            subtype: "rate_limit_error",
        });
    });

    it("자격 증명이 필요 없는 실행에는 키를 넘기지 않는다", async () => {
        const agent = new FakeCleanupAgent(emptyOutput(), false);
        const target = new SuggestCleanupUsecase(seedRepository(), agent, fixedClock, cleanupIds());

        await target.execute(prep(), attemptRun());

        expect(agent.calls[0]?.apiKey).toBeUndefined();
    });

    it("내용이 없는 궤적 스텝을 저장 대상에서 제외한다", async () => {
        const agent = new FakeCleanupAgent(emptyOutput({
            steps: [
                { seq: 0, role: "assistant", content: "생각", truncated: false, toolCalls: [] },
                { seq: 1, role: "assistant", content: "  ", truncated: false, toolCalls: [] },
            ],
        }));
        const target = new SuggestCleanupUsecase(seedRepository(), agent, fixedClock, cleanupIds());

        const output = await target.execute(prep(), attemptRun());

        expect(output.jobSteps).toHaveLength(1);
        expect(output.jobSteps[0]?.id).toBe("cleanup-id-1");
    });
});
