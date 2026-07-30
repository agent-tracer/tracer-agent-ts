export const RULE_ANCHOR_READER = Symbol("RuleAnchorReader");

/** 규칙이 매달릴 근거 하나이며 어느 태스크의 것인지와 그것이 사용자 발화인지를 든다. */
export interface RuleAnchor {
    readonly id: string;
    readonly taskId: string;
    readonly userMessage: boolean;
}

/** 규칙 생성 접수가 근거의 자격을 확인하려고 읽는 포트이며 남의 근거는 없는 것으로 본다. */
export interface RuleAnchorReaderPort {
    findById(userId: string, id: string): Promise<RuleAnchor | null>;
}
