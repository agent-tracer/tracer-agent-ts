import type { HookInput, PreToolUseHookSpecificOutput } from "@anthropic-ai/claude-agent-sdk";
import { landingDirective, progressNotice } from "~llm/runner/landing.directive.js";
import { OUTPUT_TOOL_NAME } from "~llm/runner/structured.salvage.js";

export interface ToolPacingDecision {
    readonly hookSpecificOutput: PreToolUseHookSpecificOutput;
}

export interface ToolPacing {
    /** 도구를 여는 자리마다 예산이 다해 더 열지 않는 시점인지 본다. */
    readonly landing: () => boolean;
    /** 그때까지 쓴 모델 호출 턴이다. */
    readonly modelTurns: () => number;
    readonly maxTurns: number;
    readonly hasOutputSchema: boolean;
}

/** 예산이 다해도 막지 않는 산출 도구의 이름이다. */
const OUTPUT_TOOL = OUTPUT_TOOL_NAME;

function toolNameOf(input: HookInput): string | undefined {
    return "tool_name" in input ? input.tool_name : undefined;
}

/** 도구를 여는 자리마다 남은 몫을 알리고 예산이 다하면 산출 도구를 뺀 모든 도구를 막아 마무리 지시를 준다. */
export function toolPacingHook(pacing: ToolPacing): (input: HookInput) => Promise<ToolPacingDecision> {
    const directive = landingDirective(pacing.hasOutputSchema);
    return (input) =>
        Promise.resolve(
            pacing.landing() && toolNameOf(input) !== OUTPUT_TOOL
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
