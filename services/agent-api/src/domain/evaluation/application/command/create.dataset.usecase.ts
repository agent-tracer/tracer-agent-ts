import { Inject, Injectable } from "@nestjs/common";
import { EvaluationDataset, type EvaluationExampleInput } from "~agent-api/domain/evaluation/model/dataset.model.js";
import { buildEvaluationExamples } from "../evaluation.example.factory.js";
import { EVALUATION_CLOCK, type EvaluationClockPort } from "~agent-api/domain/evaluation/port/clock.port.js";
import { EVALUATION_REPOSITORY, type EvaluationRepositoryPort } from "~agent-api/domain/evaluation/port/evaluation.repository.port.js";
import { EVALUATION_ID_GENERATOR, type EvaluationIdGeneratorPort } from "~agent-api/domain/evaluation/port/id.generator.port.js";

@Injectable()
export class CreateDatasetUseCase {
    constructor(
        @Inject(EVALUATION_REPOSITORY) private readonly repository: EvaluationRepositoryPort,
        @Inject(EVALUATION_ID_GENERATOR) private readonly ids: EvaluationIdGeneratorPort,
        @Inject(EVALUATION_CLOCK) private readonly clock: EvaluationClockPort,
    ) {}

    async execute(input: {
        readonly userId: string;
        readonly name: string;
        readonly description?: string | undefined;
        readonly examples: readonly EvaluationExampleInput[];
    }) {
        const dataset = EvaluationDataset.create(
            this.ids.next("dataset"),
            input.userId,
            input.name,
            input.description ?? "",
            this.clock.now(),
        );
        const examples = buildEvaluationExamples(input.examples, dataset.id, 1, this.ids);
        await this.repository.saveDataset(dataset, examples);
        return { dataset, examples };
    }
}
