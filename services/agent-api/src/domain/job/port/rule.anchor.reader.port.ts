export const RULE_ANCHOR_READER = Symbol("RuleAnchorReader");

/** 규칙이 매달릴 근거 하나이며 소유자와 태스크와 그것이 사용자 발화인지를 든다. */
export interface RuleAnchor {
    readonly id: string;
    readonly userId: string;
    readonly taskId: string;
    readonly userMessage: boolean;
}

/** 규칙 생성 접수가 근거의 자격을 확인하려고 읽는 포트다. */
export interface RuleAnchorReaderPort {
    findById(id: string): Promise<RuleAnchor | null>;
}
