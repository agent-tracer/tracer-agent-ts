import {
    EVALUATOR_KINDS,
    requireInteger,
    requireMember,
    requireNonEmpty,
    type EvaluatorKind,
} from "./evaluation.types.js";

/** 평가 알고리즘의 이름과 재현 가능한 구현 버전을 나타낸다. */
export class EvaluatorDefinition {
    id!: string;
    name!: string;
    kind!: EvaluatorKind;
    version!: string;
    config!: Record<string, unknown>;
    implementationHash!: string;
    enabled!: boolean;
    createdAt!: Date;

    static create(input: EvaluatorDefinition): EvaluatorDefinition {
        for (const value of [input.id, input.name, input.version, input.implementationHash]) {
            requireNonEmpty(value, "evaluator.invalid-definition");
        }
        requireMember(input.kind, EVALUATOR_KINDS, "evaluator.invalid-kind");
        return Object.assign(new EvaluatorDefinition(), input);
    }
}

/** 함께 실행할 평가자 정의 묶음을 나타낸다. */
export class EvaluatorSet {
    id!: string;
    version!: string;
    createdAt!: Date;

    static create(input: EvaluatorSet): EvaluatorSet {
        requireNonEmpty(input.id, "evaluator.invalid-set");
        requireNonEmpty(input.version, "evaluator.invalid-set");
        return Object.assign(new EvaluatorSet(), input);
    }
}

/** 평가자 세트 안의 순서 있는 구성원을 나타낸다. */
export class EvaluatorSetMember {
    id!: string;
    setId!: string;
    evaluatorDefinitionId!: string;
    ordinal!: number;

    static create(input: EvaluatorSetMember): EvaluatorSetMember {
        for (const value of [input.id, input.setId, input.evaluatorDefinitionId]) {
            requireNonEmpty(value, "evaluator.invalid-set-member");
        }
        requireInteger(input.ordinal, 0, "evaluator.invalid-set-member");
        return Object.assign(new EvaluatorSetMember(), input);
    }
}

export interface EvaluatorSetComposition {
    readonly set: EvaluatorSet;
    readonly members: readonly {
        readonly membership: EvaluatorSetMember;
        readonly evaluator: EvaluatorDefinition;
    }[];
}
