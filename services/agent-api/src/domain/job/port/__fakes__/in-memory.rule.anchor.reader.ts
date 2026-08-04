import type { RuleAnchor, RuleAnchorReaderPort } from "~agent-api/domain/job/port/rule.anchor.reader.port.js";

/** 규칙 근거 조회 포트의 인메모리 대역이며 실제 창구와 같이 사용자 범위로만 낸다. */
export class InMemoryRuleAnchorReader implements RuleAnchorReaderPort {
    private readonly rows = new Map<string, { readonly userId: string; readonly anchor: RuleAnchor }>();

    seed(userId: string, ...anchors: readonly RuleAnchor[]): void {
        for (const anchor of anchors) this.rows.set(anchor.id, { userId, anchor });
    }

    findById(userId: string, id: string): Promise<RuleAnchor | null> {
        const found = this.rows.get(id);
        return Promise.resolve(found !== undefined && found.userId === userId ? found.anchor : null);
    }
}
