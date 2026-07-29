import { describe, expect, it } from "vitest";
import type { AgentRunObservation, ResolvedAgentPrompt } from "@tracer-agent/llm";
import type { EvaluationRunEnvelope } from "~agent-worker/domain/evaluation/model/evaluation.envelope.model.js";
import type { EvaluationAgentRegistry, EvaluationDispatchContext } from "~agent-worker/domain/evaluation/port/evaluation.agent.port.js";
import { RunEvaluationUsecase } from "./run.evaluation.usecase.js";

const PROMPT: ResolvedAgentPrompt = {
    versionId: "v1", semanticVersion: "1.0.0", contentHash: "sha256:x",
    toolContractVersion: "1", outputSchemaVersion: "1",
};

const OBSERVATION: AgentRunObservation = {
    executionId: "eval:e:v:x:1", attemptId: "1", jobId: null, experimentId: "e", exampleId: "x", variantId: "v",
    agentName: "title-suggestion", backend: "claude-sdk", modelRequested: "m", modelActual: "m",
    promptVersion: "v1", promptContentHash: "sha256:x", toolContractVersion: "1", evaluatorSetVersion: null,
    status: "succeeded", durationMs: 1, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    costUsd: 0, landed: true, repairAttempted: false,
    validation: { passed: true, errorCodes: [], citationPrecision: null, citationRecall: null },
    modelCalls: [], toolCalls: [],
};

function envelope(overrides: Partial<EvaluationRunEnvelope> = {}): EvaluationRunEnvelope {
    return {
        experimentId: "e", variantId: "v", exampleId: "x", repetition: 1,
        agentName: "title-suggestion", backend: "claude-sdk", input: { taskId: "t1" }, evidence: {},
        prompt: PROMPT, ...overrides,
    };
}

describe("RunEvaluationUsecase", () => {
    it("registry에 있는 에이전트를 그 러너로 돌리고 runId를 논리 키로 만든다", async () => {
        let seenCtx: EvaluationDispatchContext | undefined;
        const agents: EvaluationAgentRegistry = {
            "title-suggestion": {
                run: (_envelope, ctx) => {
                    seenCtx = ctx;
                    return Promise.resolve({ jobId: ctx.runId, output: {}, observation: OBSERVATION });
                },
            },
        };
        const result = await new RunEvaluationUsecase(agents).execute(envelope(), { attempt: 1 });
        expect(result.jobId).toBe("eval:e:v:x:1");
        expect(seenCtx?.runId).toBe("eval:e:v:x:1");
        expect(seenCtx?.attempt).toBe(1);
    });

    it("실제 variant 출력 뒤에 봉투의 evaluator 정의로 score를 붙인다", async () => {
        const result = await new RunEvaluationUsecase({
            "title-suggestion": {
                run: (envelope, ctx) => Promise.resolve({
                    jobId: ctx.runId, output: { suggestions: [{ title: "새 제목", rationale: "근거" }] }, observation: OBSERVATION,
                }),
            },
        }).execute(envelope({
            evidence: { task: { title: "Untitled" } },
            evaluatorDefinitions: [{
                id: "title", name: "title-deterministic", version: "1.0.0+sha256.74f956cd4ee2",
                implementationHash: "74f956cd4ee2890033e195138ef2856f087fbab2db4358fa0a2149fe259df32a",
                enabled: true, config: { agentName: "title" },
            }],
        }), { attempt: 1 });
        // 이 슬라이스는 구현을 주입받지 않은 evaluator는 not_evaluable로 되돌린다.
        expect(result.scores).toEqual([expect.objectContaining({ evaluatorId: "title-deterministic", label: "not_evaluable" })]);
    });

    it("registry에 없는 에이전트는 지원하지 않는다", async () => {
        const usecase = new RunEvaluationUsecase({});
        await expect(usecase.execute(envelope({ agentName: "chat" }), { attempt: 1 })).rejects.toThrow(
            /does not support agent/,
        );
    });
});
