import type { RuleAnchor, RuleAnchorReaderPort } from "~agent-api/domain/job/port/rule.anchor.reader.port.js";

/** 규칙 근거 조회 포트의 인메모리 대역이다. */
export class InMemoryRuleAnchorReader implements RuleAnchorReaderPort {
    private readonly rows = new Map<string, RuleAnchor>();

    seed(...anchors: readonly RuleAnchor[]): void {
        for (const anchor of anchors) this.rows.set(anchor.id, anchor);
    }

    findById(id: string): Promise<RuleAnchor | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }
}
