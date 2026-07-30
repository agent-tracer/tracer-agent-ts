import { Inject, Injectable } from "@nestjs/common";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";
import { EXPERIMENT_RANDOM, type ExperimentRandomPort } from "~agent-api/domain/evaluation/port/experiment.support.port.js";

@Injectable()
export class DrawReviewPairUseCase {
    constructor(
        @Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort,
        @Inject(EXPERIMENT_RANDOM) private readonly random: ExperimentRandomPort,
    ) {}
    async execute(userId: string, experimentId: string) {
        if (await this.repository.findExperiment(userId, experimentId) === null) throw new Error("Experiment not found");
        const executions = await this.repository.listExecutions(userId, experimentId);
        const reviews = await this.repository.listReviews(userId, experimentId);
        const candidates: { a: string; b: string }[] = [];
        for (const left of executions) for (const right of executions) {
            if (left.id >= right.id || left.status !== "succeeded" || right.status !== "succeeded") continue;
            if (left.exampleId !== right.exampleId || left.repetition !== right.repetition || left.variantId === right.variantId) continue;
            const reviewed = reviews.some((row) =>
                new Set([row.executionAId, row.executionBId]).has(left.id)
                && new Set([row.executionAId, row.executionBId]).has(right.id));
            if (!reviewed) candidates.push({ a: left.id, b: right.id });
        }
        const pair = candidates[Math.floor(this.random.number() * candidates.length)];
        if (pair === undefined) return null;
        const swapped = this.random.boolean();
        const a = executions.find((row) => row.id === (swapped ? pair.b : pair.a));
        const b = executions.find((row) => row.id === (swapped ? pair.a : pair.b));
        if (a === undefined || b === undefined) return null;
        return { executionA: { id: a.id, output: a.output }, executionB: { id: b.id, output: b.output },
            exampleId: a.exampleId, repetition: a.repetition };
    }
}
