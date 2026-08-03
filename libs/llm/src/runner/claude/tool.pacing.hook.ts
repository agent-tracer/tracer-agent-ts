import type { PreToolUseHookSpecificOutput } from "@anthropic-ai/claude-agent-sdk";
import { landingDirective, progressNotice } from "~llm/runner/landing.directive.js";

export interface ToolPacingDecision {
    readonly hookSpecificOutput: PreToolUseHookSpecificOutput;
}

export interface ToolPacing {
    /** 예산이 다해 도구를 더 열지 않는 시점인지 그때그때 본다. */
    readonly landing: () => boolean;
    /** 그때까지 쓴 모델 호출 턴이다. */
    readonly modelTurns: () => number;
    readonly maxTurns: number;
    readonly hasOutputSchema: boolean;
}

/** 도구를 여는 자리마다 남은 몫을 알리고 예산이 다하면 그 도구만 막아 마무리 지시를 준다. */
export function toolPacingHook(pacing: ToolPacing): () => Promise<ToolPacingDecision> {
    const directive = landingDirective(pacing.hasOutputSchema);
    return () =>
        Promise.resolve(
            pacing.landing()
                ? {
                    hookSpecificOutput: {
                        hookEventName: "PreToolUse" as const,
                        permissionDecision: "deny" as const,
                        permissionDecisionReason: directive,
                    },
                }
                : {
                    hookSpecificOutput: {
                        hookEventName: "PreToolUse" as const,
                        additionalContext: progressNotice(pacing.modelTurns(), pacing.maxTurns),
                    },
                },
        );
}
