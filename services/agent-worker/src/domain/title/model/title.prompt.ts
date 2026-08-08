import type { ResolvedAgentPrompt } from "@tracer-agent/llm";
import type { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import type { TitleContext } from "./title.context.model.js";
import { TITLE_TOOL_CONTRACT } from "./title.tool.schema.js";

export const TITLE_SYSTEM_TEMPLATE_KEY = "title-suggestion.investigator.system" as const;

export const TITLE_REPAIR_TEMPLATE_KEY = "title-suggestion.investigator.repair" as const;

// 남은 턴은 도구를 열 때마다 페이싱 훅이 실제 상한으로 알리므로 이 문단은 턴 수를 말하지 않는다.
const PULL_MORE_EVIDENCE = [
    "If the excerpt already shows what the task is about, answer directly without any tool call. When it",
    "is too thin or truncated to name the work, pull more evidence yourself with get_task_events: you",
    `choose limit and cursor, and order="desc" reads the ending of a long task first. Stop pulling as`,
    "soon as you can name the work.",
].join("\n");

/** 도구 접두사가 붙지 않은 기준 시스템 프롬프트다. */
export function buildTitleSystemPrompt(prompt: AgentPrompt, language: OutputLanguage): string {
    const slot = (name: string): string => prompt.slot(TITLE_SYSTEM_TEMPLATE_KEY, name);
    return [
        "You rename recorded coding-agent tasks so the title actually reflects what happened.",
        "",
        slot("contextShape"),
        "",
        PULL_MORE_EVIDENCE,
        "",
        slot("titleSpec"),
        "",
        slot("answerShape"),
        "",
        `Output language: ${prompt.languageDirective(language)}`,
        "",
        "Return the suggestions as structured output conforming to the provided schema.",
    ].join("\n");
}

/** 실행에 실을 계약의 판이며 실행은 원장 없이 이 값을 그대로 쓴다. */
export function resolveTitlePromptPin(prompt: AgentPrompt): ResolvedAgentPrompt {
    return {
        promptVersion: prompt.version(),
        toolContractVersion: TITLE_TOOL_CONTRACT.version,
    };
}

/** 검증에 걸린 출력을 모델에게 돌려줘 한 번 고쳐 받는 지시문이며 직전 출력을 함께 싣는다. */
export function buildTitleRepairPrompt(
    prompt: AgentPrompt,
    basePrompt: string,
    previousOutput: unknown,
    errors: readonly string[],
): string {
    return [
        basePrompt,
        "",
        "Your previous output:",
        JSON.stringify(previousOutput),
        "",
        "Deterministic validation rejected your output:",
        ...errors.map((error) => `  - ${error}`),
        "",
        prompt.slot(TITLE_REPAIR_TEMPLATE_KEY, "repairDirective"),
    ].join("\n");
}

export function buildTitleUserPrompt(taskId: string, context: TitleContext): string {
    const lines: string[] = [
        `Task ID: ${taskId}`,
        `Current title: ${context.title}`,
        `Status: ${context.status}`,
    ];
    if (context.workspacePath !== undefined) lines.push(`Workspace: ${context.workspacePath}`);
    lines.push(
        "",
        `Activity: ${context.totalEventCount} events across ${context.totalTurnCount} conversation turns.`,
    );
    if (context.truncated) {
        lines.push(
            `Showing the first turn and the most recent ${context.turns.length - 1} turns (older turns omitted).`,
        );
    }
    lines.push("");
    if (context.turns.length === 0) {
        lines.push("(no conversation turns recorded)");
    } else {
        for (const turn of context.turns) {
            lines.push(`User: ${turn.askedText}`);
            if (turn.assistantText !== null) lines.push(`Assistant: ${turn.assistantText}`);
            lines.push("");
        }
    }
    lines.push(
        "If the current title already reads cleanly, return an empty suggestions list. Otherwise propose 2-3 alternative titles.",
    );
    return lines.join("\n");
}
