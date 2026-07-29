import { Inject, Injectable } from "@nestjs/common";
import { EVALUATION_REPOSITORY, type EvaluationRepositoryPort } from "~agent-api/domain/evaluation/port/evaluation.repository.port.js";

@Injectable()
export class ListEvaluatorsUseCase {
    constructor(@Inject(EVALUATION_REPOSITORY) private readonly repository: EvaluationRepositoryPort) {}

    async execute() {
        return { evaluators: await this.repository.listEvaluatorDefinitions() };
    }
}
