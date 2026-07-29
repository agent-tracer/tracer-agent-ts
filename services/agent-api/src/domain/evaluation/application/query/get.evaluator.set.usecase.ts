import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EVALUATION_REPOSITORY, type EvaluationRepositoryPort } from "~agent-api/domain/evaluation/port/evaluation.repository.port.js";

@Injectable()
export class GetEvaluatorSetUseCase {
    constructor(@Inject(EVALUATION_REPOSITORY) private readonly repository: EvaluationRepositoryPort) {}

    async execute(version: string) {
        const composition = await this.repository.findEvaluatorSet(version);
        if (composition === null) throw new NotFoundException("Evaluator set not found");
        return composition;
    }
}
