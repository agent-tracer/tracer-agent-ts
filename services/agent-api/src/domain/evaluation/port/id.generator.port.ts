export const EVALUATION_ID_GENERATOR = Symbol("EvaluationIdGenerator");

export interface EvaluationIdGeneratorPort {
    next(scope: "dataset" | "example" | "evaluator" | "evaluator-set" | "evaluator-member"): string;
}
