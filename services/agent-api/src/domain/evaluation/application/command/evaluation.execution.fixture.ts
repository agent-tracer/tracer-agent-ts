import { FixedExperimentClock, SequentialExperimentIdGenerator } from "~agent-api/domain/evaluation/port/__fakes__/experiment.support.fakes.js";
import { InMemoryExperimentRepository } from "~agent-api/domain/evaluation/port/__fakes__/in-memory.experiment.repository.js";
import { anExperiment, aVariant, EXPERIMENT_NOW } from "../experiment.test.fixture.js";
import { FinalizeEvaluationExperimentUseCase } from "./finalize.evaluation.experiment.usecase.js";
import { LeaseEvaluationExecutionUseCase } from "./lease.evaluation.execution.usecase.js";
import { ReleaseEvaluationExecutionUseCase } from "./release.evaluation.execution.usecase.js";
import { SettleEvaluationExecutionUseCase } from "./settle.evaluation.execution.usecase.js";

export function harness() {
    const repository = new InMemoryExperimentRepository();
    repository.experiments.push(anExperiment({ status: "running", maxBudgetUsd: 10 }));
    repository.variants.push(aVariant());
    repository.context = {
        variant: aVariant(),
        example: { id: "example-1", input: {}, evidence: {}, referenceOutput: null },
        prompt: { id: "prompt-1" },
        evaluatorDefinitions: [{ id: "evaluator-1" }],
    };
    const clock = new FixedExperimentClock(EXPERIMENT_NOW);
    return {
        repository,
        clock,
        lease: new LeaseEvaluationExecutionUseCase(repository, clock),
        settle: new SettleEvaluationExecutionUseCase(repository, clock, new SequentialExperimentIdGenerator()),
        release: new ReleaseEvaluationExecutionUseCase(repository, clock),
        finalize: new FinalizeEvaluationExperimentUseCase(repository, clock),
    };
}

export const SETTLEMENT = {
    userId: "user-1",
    executionId: "execution-1",
    attempt: 1,
    jobId: "job-1",
    output: { answer: "값" },
    durationMs: 1200,
    traceId: "trace-1",
    costUsd: 0.5,
    resolvedPromptHash: "hash-1",
    scores: [{ evaluatorId: "evaluator-1", evaluatorVersion: "1", score: 1 }],
};
