import { Inject, Injectable } from "@nestjs/common";
import { EVALUATION_REPOSITORY, type EvaluationRepositoryPort } from "~agent-api/domain/evaluation/port/evaluation.repository.port.js";

@Injectable()
export class ListDatasetsUseCase {
    constructor(@Inject(EVALUATION_REPOSITORY) private readonly repository: EvaluationRepositoryPort) {}

    async execute(userId: string) {
        return { datasets: await this.repository.listDatasets(userId) };
    }
}
