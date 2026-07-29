export type DeterministicEvaluatorLabel = "pass" | "fail" | "not_evaluable";

export interface DeterministicEvaluatorInput {
    readonly output: Record<string, unknown> | null;
    readonly referenceOutput: Record<string, unknown> | null;
    readonly input: Readonly<Record<string, unknown>>;
    readonly evidence: Readonly<Record<string, unknown>>;
}

export interface DeterministicEvaluatorResult {
    readonly score: number | null;
    readonly label: DeterministicEvaluatorLabel;
    readonly reason: string;
    readonly judgeCostUsd: number;
}

/** 출력 스키마를 아는 에이전트 슬라이스가 채점 로직을 소유하고, 이 슬라이스는 계약만 선언해 조립 근원이 구현을 주입받는다. */
export interface DeterministicEvaluatorImplementation {
    readonly name: string;
    readonly implementationHash: string;
    evaluate(input: DeterministicEvaluatorInput, config: Readonly<Record<string, unknown>>): DeterministicEvaluatorResult;
}
