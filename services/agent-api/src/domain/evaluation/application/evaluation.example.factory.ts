import { EvaluationExample, type EvaluationExampleInput } from "../model/dataset.model.js";
import { computeEvaluationExampleContentHash } from "../model/evaluation.example.hash.js";
import type { EvaluationIdGeneratorPort } from "../port/id.generator.port.js";

export function buildEvaluationExamples(
    inputs: readonly EvaluationExampleInput[],
    datasetId: string,
    revision: number,
    ids: EvaluationIdGeneratorPort,
): EvaluationExample[] {
    return inputs.map((value) => {
        const referenceOutput = value.referenceOutput ?? null;
        const evidence = value.evidence ?? {};
        return EvaluationExample.create({
            ...value,
            id: ids.next("example"),
            datasetId,
            revision,
            referenceOutput,
            evidence,
            contentHash: computeEvaluationExampleContentHash({
                input: value.input,
                referenceOutput,
                evidence,
            }),
        });
    });
}
