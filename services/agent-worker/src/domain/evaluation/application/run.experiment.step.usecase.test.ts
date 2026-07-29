import { describe, expect, it } from "vitest";
import type { AgentRunObservation } from "@tracer-agent/llm";
import type { EvaluationRunEnvelope } from "~agent-worker/domain/evaluation/model/evaluation.envelope.model.js";
import type { EvaluationAgentRegistry } from "~agent-worker/domain/evaluation/port/evaluation.agent.port.js";
import type {
    EvaluationExecutionFailure,
    EvaluationExecutionLease,
    EvaluationExecutionSettlement,
} from "~agent-worker/domain/evaluation/model/evaluation.experiment.model.js";
import type { EvaluationExecutionClient } from "~agent-worker/domain/evaluation/port/evaluation.execution.client.port.js";
import { RunEvaluationUsecase } from "./run.evaluation.usecase.js";
import { RunExperimentStepUsecase } from "./run.experiment.step.usecase.js";

const OBSERVATION: AgentRunObservation = {
    executionId: "eval:e:v:x:1", attemptId: "1", jobId: null, experimentId: "e", exampleId: "x", variantId: "v",
    agentName: "title-suggestion", backend: "claude-sdk", modelRequested: "m", modelActual: "m",
    promptVersion: "v1", promptContentHash: "sha256:x", toolContractVersion: "1", evaluatorSetVersion: null,
    status: "succeeded", durationMs: 1, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    costUsd: 0, landed: true, repairAttempted: false,
    validation: { passed: true, errorCodes: [], citationPrecision: null, citationRecall: null },
    modelCalls: [], toolCalls: [],
};

function lease(overrides: Partial<EvaluationExecutionLease> = {}): EvaluationExecutionLease {
    return {
        execution: { id: "execution-1", attemptCount: 1, repetition: 1 },
        variant: { id: "v", agentName: "title-suggestion", backend: "claude-sdk", model: "m" },
        example: { id: "x", input: {}, evidence: {}, referenceOutput: null },
        prompt: { id: "prompt-1", semanticVersion: "1.0.0", contentHash: "sha256:x", toolContractVersion: "1", outputSchemaVersion: "1" },
        evaluatorDefinitions: [],
        amount: 1,
        priorCostUsd: 0,
        ...overrides,
    };
}

function fakeClient(overrides: Partial<EvaluationExecutionClient> = {}, leaseValue: EvaluationExecutionLease | null = lease()): EvaluationExecutionClient & {
    settled: EvaluationExecutionSettlement[];
    released: EvaluationExecutionFailure[];
} {
    const settled: EvaluationExecutionSettlement[] = [];
    const released: EvaluationExecutionFailure[] = [];
    return {
        lease: () => Promise.resolve(leaseValue),
        settle: (input) => {
            settled.push(input);
            return Promise.resolve();
        },
        release: (input) => {
            released.push(input);
            return Promise.resolve();
        },
        finalize: () => Promise.resolve(),
        settled,
        released,
        ...overrides,
    };
}

function agents(run: (envelope: EvaluationRunEnvelope) => Promise<{ jobId: string; output: Record<string, unknown>; observation: AgentRunObservation }>): EvaluationAgentRegistry {
    return { "title-suggestion": { run: (envelope, ctx) => run(envelope).then((result) => ({ ...result, jobId: ctx.runId })) } };
}

describe("RunExperimentStepUsecase", () => {
    it("lease가 없으면 false를 돌려주고 실행하지 않는다", async () => {
        const client = fakeClient({}, null);
        const usecase = new RunExperimentStepUsecase(client, new RunEvaluationUsecase({}));
        const more = await usecase.execute({ userId: "user", experimentId: "e" });
        expect(more).toBe(false);
        expect(client.settled).toHaveLength(0);
    });

    it("lease된 실행을 돌리고 settle로 결과를 반영한다", async () => {
        const client = fakeClient();
        const usecase = new RunExperimentStepUsecase(
            client,
            new RunEvaluationUsecase(agents(() => Promise.resolve({ jobId: "unused", output: { ok: true }, observation: OBSERVATION }))),
        );
        const more = await usecase.execute({ userId: "user", experimentId: "e" });
        expect(more).toBe(true);
        expect(client.settled[0]).toMatchObject({ executionId: "execution-1", attempt: 1, output: { ok: true } });
    });

    it("실행이 실패하면 release하고 다시 던진다", async () => {
        const client = fakeClient();
        const usecase = new RunExperimentStepUsecase(
            client,
            new RunEvaluationUsecase(agents(() => Promise.reject(new Error("boom")))),
        );
        await expect(usecase.execute({ userId: "user", experimentId: "e" })).rejects.toThrow("boom");
        expect(client.released[0]).toMatchObject({ executionId: "execution-1", attempt: 1, terminal: false });
    });

    it("finalize는 그대로 client에 위임한다", async () => {
        let seen: unknown;
        const client = fakeClient({ finalize: (input) => { seen = input; return Promise.resolve(); } });
        const usecase = new RunExperimentStepUsecase(client, new RunEvaluationUsecase({}));
        await usecase.finalize({ userId: "user", experimentId: "e", cancelled: false, failed: true, budgetExhausted: false });
        expect(seen).toMatchObject({ failed: true });
    });
});
