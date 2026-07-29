import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EVALUATION_REPOSITORY, type EvaluationRepositoryPort } from "~agent-api/domain/evaluation/port/evaluation.repository.port.js";

@Injectable()
export class GetDatasetUseCase {
    constructor(@Inject(EVALUATION_REPOSITORY) private readonly repository: EvaluationRepositoryPort) {}

    async execute(userId: string, id: string) {
        const dataset = await this.repository.findDataset(userId, id);
        if (dataset === null) throw new NotFoundException("Dataset not found");
        const examples = await this.repository.listExamples(userId, id, dataset.currentRevision);
        return { dataset, examples };
    }
}
