import type { EvaluationEvaluatorDefinition, EvaluationScore } from "./evaluation.envelope.model.js";
import type { DeterministicEvaluatorImplementation, DeterministicEvaluatorInput } from "./deterministic.evaluator.model.js";

/** 평가 봉투의 DB 정의를 조립 근원이 주입한 결정적 evaluator 구현으로 연결한다. */
export class EvaluatorRegistry {
    private readonly implementations: ReadonlyMap<string, DeterministicEvaluatorImplementation>;

    constructor(implementations: readonly DeterministicEvaluatorImplementation[] = []) {
        this.implementations = new Map(implementations.map((implementation) => [implementation.name, implementation]));
    }

    evaluate(
        definitions: readonly EvaluationEvaluatorDefinition[],
        input: DeterministicEvaluatorInput,
    ): readonly EvaluationScore[] {
        return definitions.map((definition) => {
            const implementation = this.implementations.get(definition.name);
            if (
                implementation === undefined
                || !definition.enabled
                || implementation.implementationHash !== definition.implementationHash
            ) {
                return {
                    evaluatorId: definition.name,
                    evaluatorVersion: definition.version,
                    score: null,
                    label: "not_evaluable",
                    reason: !definition.enabled ? "evaluator_disabled" : `implementation_unavailable:${definition.name}`,
                    judgeCostUsd: 0,
                };
            }
            return {
                evaluatorId: definition.name,
                evaluatorVersion: definition.version,
                ...implementation.evaluate(input, definition.config),
            };
        });
    }
}
