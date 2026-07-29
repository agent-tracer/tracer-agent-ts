import type { EvaluationIdGeneratorPort } from "../id.generator.port.js";

export class SequentialEvaluationIdGenerator implements EvaluationIdGeneratorPort {
    private sequence = 0;

    next(scope: Parameters<EvaluationIdGeneratorPort["next"]>[0]): string {
        this.sequence += 1;
        return `${scope}-${this.sequence}`;
    }
}
