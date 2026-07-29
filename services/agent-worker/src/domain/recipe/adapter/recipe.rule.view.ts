import type { RecipeRule, RecipeRuleExpectation } from "~agent-worker/domain/recipe/port/recipe.reader.port.js";

export interface SlimRule {
    readonly id: string;
    readonly name: string;
    readonly expect: Record<string, unknown>;
    readonly taskId: string;
    readonly anchorEventId: string;
    readonly source: string;
    readonly severity: string;
    readonly rationale: string | null;
    readonly signature: string;
    readonly createdAt: string;
}

/** 규칙 표현을 모델 입력 뷰로 바꾼다. */
export function toSlimRule(rule: RecipeRule): SlimRule {
    return {
        id: rule.id,
        name: rule.name,
        expect: toExpectView(rule.expectation),
        taskId: rule.taskId,
        anchorEventId: rule.anchorEventId,
        source: rule.source,
        severity: rule.severity,
        rationale: rule.rationale,
        signature: rule.signature,
        createdAt: rule.createdAt.toISOString(),
    };
}

function toExpectView(expectation: RecipeRuleExpectation): Record<string, unknown> {
    switch (expectation.kind) {
        case "command":
            return { kind: expectation.kind, commandMatches: expectation.commandMatches };
        case "pattern":
            return {
                kind: expectation.kind,
                pattern: expectation.pattern,
                ...(expectation.tool !== undefined ? { action: expectation.tool } : {}),
            };
        case "action":
            return { kind: expectation.kind, action: expectation.tool };
    }
}
