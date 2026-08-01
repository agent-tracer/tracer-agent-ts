import {
    computeResolvedPromptBundleHash,
    type AgentPromptBundle,
    type ResolvedAgentPrompt,
} from "@tracer-agent/llm";
import type { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import type { TitleContext } from "./title.context.model.js";

export const TITLE_SYSTEM_TEMPLATE_KEY = "title-suggestion.investigator.system" as const;

export const TITLE_REPAIR_TEMPLATE_KEY = "title-suggestion.investigator.repair" as const;

export const TITLE_SUGGESTION_MAX_TURNS = 4;

/** 이 번들이 바뀔 때마다 사람이 올리는 표시이며 기동 검사가 이 값을 원장의 채널과 대조한다. */
export const TITLE_PROMPT_VERSION = "v1";

const TOOL_CONTRACT_VERSION = "1";
const OUTPUT_SCHEMA_VERSION = "1";

// 도구 예산을 무엇으로 세는지는 실행 기계가 소유하므로 근거를 더 모으라는 문단만 이 구현이 쓴다.
const PULL_MORE_EVIDENCE = [
    "If the excerpt already shows what the task is about, answer directly without any tool call. When it",
    "is too thin or truncated to name the work, pull more evidence yourself with get_task_events: you",
    `choose limit and cursor, and order="desc" reads the ending of a long task first. You have up to`,
    `${TITLE_SUGGESTION_MAX_TURNS} tool turns; stop pulling as soon as you can name the work.`,
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

/** 실행에 실을 이 번들의 코드 고정값이며 실행은 원장 없이 이 값을 그대로 쓴다. */
export function resolveTitlePromptPin(
    prompt: AgentPrompt,
    language: OutputLanguage,
): ResolvedAgentPrompt {
    const bundle: AgentPromptBundle = { investigatorSystemPrompt: buildTitleSystemPrompt(prompt, language) };
    return {
        versionId: `title-suggestion:${language}:${TITLE_PROMPT_VERSION}`,
        semanticVersion: TITLE_PROMPT_VERSION,
        contentHash: computeResolvedPromptBundleHash(bundle).resolvedPromptHash,
        toolContractVersion: TOOL_CONTRACT_VERSION,
        outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
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
