import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { EvaluationExampleInput } from "~agent-api/domain/evaluation/model/dataset.model.js";
import { buildEvaluationExamples } from "../evaluation.example.factory.js";
import { EVALUATION_REPOSITORY, type EvaluationRepositoryPort } from "~agent-api/domain/evaluation/port/evaluation.repository.port.js";
import { EVALUATION_ID_GENERATOR, type EvaluationIdGeneratorPort } from "~agent-api/domain/evaluation/port/id.generator.port.js";

@Injectable()
export class ReviseDatasetUseCase {
    constructor(
        @Inject(EVALUATION_REPOSITORY) private readonly repository: EvaluationRepositoryPort,
        @Inject(EVALUATION_ID_GENERATOR) private readonly ids: EvaluationIdGeneratorPort,
    ) {}

    async execute(input: {
        readonly userId: string;
        readonly datasetId: string;
        readonly examples: readonly EvaluationExampleInput[];
    }) {
        const dataset = await this.repository.findDataset(input.userId, input.datasetId);
        if (dataset === null) throw new NotFoundException("Dataset not found");
        if (await this.repository.hasStartedExperiment(input.userId, dataset.id)) {
            throw new ConflictException("Dataset used by a started experiment is immutable");
        }
        const revision = dataset.nextRevision();
        const examples = buildEvaluationExamples(input.examples, dataset.id, revision, this.ids);
        await this.repository.saveDataset(dataset, examples);
        return { dataset, examples };
    }
}
