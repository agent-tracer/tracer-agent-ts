import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DatasetCandidate, DatasetCandidateReason } from "~agent-api/domain/evaluation/model/dataset.candidate.model.js";
import { EVALUATION_CLOCK, type EvaluationClockPort } from "~agent-api/domain/evaluation/port/clock.port.js";
import { EVALUATION_REPOSITORY, type EvaluationRepositoryPort } from "~agent-api/domain/evaluation/port/evaluation.repository.port.js";

@Injectable()
export class SuggestDatasetCandidatesUseCase {
    constructor(
        @Inject(EVALUATION_REPOSITORY) private readonly repository: EvaluationRepositoryPort,
        @Inject(EVALUATION_CLOCK) private readonly clock: EvaluationClockPort,
    ) {}

    async execute(userId: string, experimentId: string, scoreThreshold = 0.5): Promise<DatasetCandidate[]> {
        const experiment = await this.repository.findExperiment(userId, experimentId);
        if (experiment === null) throw new NotFoundException("Experiment not found");
        const examples = await this.repository.listExamples(
            userId,
            experiment.datasetId,
            experiment.datasetRevision,
        );
        const inputs = new Map(examples.map((example) => [example.id, example.input]));
        const candidates: DatasetCandidate[] = [];
        for (const execution of await this.repository.listExecutions(userId, experimentId)) {
            const scores = await this.repository.listScores(userId, execution.id);
            const numeric = scores.flatMap((score) => score.score === null ? [] : [score.score]);
            const minimum = numeric.length === 0 ? null : Math.min(...numeric);
            const reason: DatasetCandidateReason | null = execution.status === "failed"
                ? "failure"
                : minimum !== null && minimum < scoreThreshold ? "user-correction" : null;
            if (reason === null) continue;
            candidates.push({
                executionId: execution.id,
                exampleId: execution.exampleId,
                reason,
                agentName: execution.variantId,
                input: inputs.get(execution.exampleId) ?? {},
                output: execution.output,
                score: minimum,
                createdAt: this.clock.now().toISOString(),
            });
        }
        return candidates;
    }
}
