import type { EvaluationScore, Experiment, ExperimentExecution, ExperimentVariant } from "../model/experiment.model.js";
import { InMemoryExperimentRepository } from "../port/__fakes__/in-memory.experiment.repository.js";

export const EXPERIMENT_NOW = new Date("2026-01-01T00:00:00.000Z");

export function experimentHarness() {
    return { repository: new InMemoryExperimentRepository() };
}

export function anExperiment(overrides: Partial<Experiment> = {}): Experiment {
    return {
        id: "experiment-1", userId: "user-1", datasetId: "dataset-1", datasetRevision: 1,
        evaluatorSetVersion: "default-v1", maxBudgetUsd: 1, repetitions: 1, status: "draft",
        createdAt: EXPERIMENT_NOW, completedAt: null, ...overrides,
    };
}

export function aVariant(overrides: Partial<ExperimentVariant> = {}): ExperimentVariant {
    return {
        id: "variant-1", experimentId: "experiment-1", name: "baseline", baseline: true,
        backend: "claude-sdk", agentName: "title-suggestion", promptVersionId: null,
        toolContractVersion: "1", limits: {}, fragmentSelections: {}, ...overrides,
    };
}

export function anExecution(overrides: Partial<ExperimentExecution> = {}): ExperimentExecution {
    return {
        id: "execution-1", experimentId: "experiment-1", variantId: "variant-1", exampleId: "example-1",
        repetition: 1, status: "succeeded", output: { answer: "값" }, error: null, costUsd: 0.01,
        startedAt: EXPERIMENT_NOW, completedAt: EXPERIMENT_NOW, ...overrides,
    };
}

export function aScore(overrides: Partial<EvaluationScore> = {}): EvaluationScore {
    return {
        id: "score-1", executionId: "execution-1", evaluatorId: "evaluator-1", evaluatorVersion: "1",
        score: 1, label: null, reason: null, judgeCostUsd: 0, createdAt: EXPERIMENT_NOW, ...overrides,
    };
}
