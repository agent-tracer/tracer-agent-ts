import { EvaluationDataset, EvaluationExample } from "../model/dataset.model.js";
import type { ExportFilteringPolicy } from "../model/training.export.model.js";
import { FixedEvaluationClock } from "../port/__fakes__/fixed.clock.js";
import { InMemoryEvaluationRepository } from "../port/__fakes__/in-memory.evaluation.repository.js";
import { SequentialEvaluationIdGenerator } from "../port/__fakes__/sequential.evaluation.id.generator.js";

export const TEST_NOW = new Date("2026-01-01T00:00:00.000Z");
export const TEST_POLICY: ExportFilteringPolicy = {
    excludeDisabled: true,
    disclosureClasses: ["synthetic"],
    minScore: null,
};

export function evaluationHarness() {
    return {
        repository: new InMemoryEvaluationRepository(),
        ids: new SequentialEvaluationIdGenerator(),
        clock: new FixedEvaluationClock(TEST_NOW),
    };
}

export async function seedDataset(repository: InMemoryEvaluationRepository) {
    const dataset = EvaluationDataset.create("dataset-1", "user-1", "회귀", "", TEST_NOW);
    const example = EvaluationExample.create({
        id: "example-1",
        datasetId: dataset.id,
        revision: 1,
        input: { prompt: "입력" },
        referenceOutput: { answer: "기대" },
        disclosureClass: "synthetic",
        contentHash: "hash-1",
    });
    await repository.saveDataset(dataset, [example]);
    return { dataset, example };
}
