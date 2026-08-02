import type { ResolvedAgentPrompt } from "@tracer-agent/llm";
import type { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import type { DispatchPlan, ProbeAssignment, ProbeReport } from "./recipe.dispatch.schema.js";
import { RECIPE_CANDIDATE_LIMIT, RECIPE_TOOL_CONTRACT } from "./recipe.tool.schema.js";

export const RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY = "recipe-scan.investigator.system" as const;
export const RECIPE_INVESTIGATOR_REPAIR_TEMPLATE_KEY = "recipe-scan.investigator.repair" as const;
export const RECIPE_SURVEY_SYSTEM_TEMPLATE_KEY = "recipe-scan.survey.system" as const;
export const RECIPE_PROBE_SYSTEM_TEMPLATE_KEY = "recipe-scan.probe.system" as const;
export const RECIPE_PROBE_USER_TEMPLATE_KEY = "recipe-scan.probe.user" as const;
export const RECIPE_SURVEY_USER_TEMPLATE_KEY = "recipe-scan.survey.user" as const;



/** 도구 접두사가 붙지 않은, 조율자가 읽는 기준 시스템 프롬프트다. */
export function buildRecipeSystemPrompt(prompt: AgentPrompt): string {
    const slot = (name: string): string => prompt.slot(RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY, name);
    return [
        `You turn one user-selected coding-agent task into reusable "recipes".`,
        "",
        slot("recipeDefinition"),
        "",
        slot("evidenceSourcing"),
        "",
        "How to work:",
        slot("turnSplitting"),
        "",
        slot("citationDiscipline"),
        "",
        slot("candidateBudget"),
        "",
        slot("redispatchProtocol"),
        "",
        slot("outputFields"),
        "",
        "Rules:",
        slot("qualityRules"),
        "",
        "Return the recipes as structured output conforming to the provided schema.",
    ].join("\n");
}

/** 근거 검증에 걸린 출력을 모델에게 돌려줘 한 번 고쳐 받는 지시문이며 직전 출력을 함께 싣는다. */
export function buildRecipeRepairPrompt(
    prompt: AgentPrompt,
    basePrompt: string,
    previousOutput: unknown,
    errors: readonly string[],
): string {
    return [
        basePrompt,
        "",
        prompt.slot(RECIPE_INVESTIGATOR_REPAIR_TEMPLATE_KEY, "repairPriorOutput"),
        JSON.stringify(previousOutput),
        "",
        "Deterministic provenance validation rejected your output:",
        ...errors.map((error) => `  - ${error}`),
        "",
        buildRecipeRepairDirective(prompt),
    ].join("\n");
}

export function buildRecipeRepairDirective(prompt: AgentPrompt): string {
    return prompt.slot(RECIPE_INVESTIGATOR_REPAIR_TEMPLATE_KEY, "repairDirective");
}

export function buildRecipeUserPrompt(
    prompt: AgentPrompt,
    taskId: string,
    userPrompt: string | undefined,
    language: OutputLanguage,
    plan: DispatchPlan | null = null,
    reports: readonly ProbeReport[] = [],
): string {
    const lines: string[] = [`Anchor taskId: ${taskId}`];
    if (userPrompt !== undefined && userPrompt.trim().length > 0) {
        lines.push(`User prompt: ${userPrompt.trim()}`);
    }
    lines.push(
        "",
        `Output language: ${prompt.languageDirective(language)}`,
        "",
        `Return one candidate per distinct reusable workflow, up to ${RECIPE_CANDIDATE_LIMIT}.`,
    );
    return lines.join("\n") + renderRecipePlan(plan) + renderRecipeReports(reports);
}

/** 조율자가 세운 계획을 종합 호출이 읽을 지시문으로 편다. */
function renderRecipePlan(plan: DispatchPlan | null): string {
    if (plan === null || plan.probes.length === 0) return "";
    const lines = plan.probes.map(
        (probe) => `- ${probe.probe} (weight ${probe.weight}): ${probe.question}`,
    );
    return "\n\nYour own plan for this investigation:\n" + lines.join("\n");
}

/** 전문가들이 올린 보고를 종합 호출이 읽을 근거로 편다. */
function renderRecipeReports(reports: readonly ProbeReport[]): string {
    if (reports.length === 0) return "";
    const blocks = reports.map((report) => {
        const lines = [
            `### ${report.probe}` + (report.exhausted ? " (turns exhausted)" : ""),
            report.verdict,
        ];
        for (const excerpt of report.excerpts) {
            lines.push(`- [${excerpt.taskId}/${excerpt.eventId}] ${excerpt.text}`);
        }
        return lines.join("\n");
    });
    return "\n\nWhat your specialists reported:\n\n" + blocks.join("\n\n");
}

export function buildRecipeSurveySystemPrompt(prompt: AgentPrompt): string {
    const slot = (name: string): string => prompt.slot(RECIPE_SURVEY_SYSTEM_TEMPLATE_KEY, name);
    return [
        "You plan one recipe-scan investigation before it starts.",
        "",
        slot("specialistCatalog"),
        "",
        slot("dispatchWeighting"),
        "",
        slot("emptyPlan"),
    ].join("\n");
}

export function buildRecipeSurveyPrompt(
    prompt: AgentPrompt,
    taskId: string,
    userPrompt: string | undefined,
    availableTurns: number,
): string {
    const lines = [
        `Anchor task ID: ${taskId}`,
        prompt.slot(RECIPE_SURVEY_USER_TEMPLATE_KEY, "turnAllowance", { turns: String(availableTurns) }),
    ];
    if (userPrompt !== undefined && userPrompt.trim().length > 0) {
        lines.push(`What the user asked for: ${userPrompt.trim()}`);
    }
    return lines.join("\n");
}

// 예산 소진을 무엇으로 세는지는 실행 기계가 소유하므로 마지막 문장만 이 구현이 쓴다.
export function buildRecipeProbeSystemPrompt(prompt: AgentPrompt): string {
    const slot = (name: string): string => prompt.slot(RECIPE_PROBE_SYSTEM_TEMPLATE_KEY, name);
    return [
        "You are one specialist in a recipe-scan investigation.",
        "",
        slot("specialistCharter"),
        "",
        slot("specialistReporting"),
        "",
        slot("probeBoundary"),
        "",
        slot("budgetExhaustion"),
    ].join("\n");
}

export function buildRecipeProbePrompt(
    prompt: AgentPrompt,
    taskId: string,
    question: string,
    turns: number,
    siblings: readonly ProbeAssignment[] = [],
): string {
    const lines = [
        `Anchor task ID: ${taskId}`,
        `Your question: ${question}`,
        prompt.slot(RECIPE_PROBE_USER_TEMPLATE_KEY, "turnAllowance", { turns: String(turns) }),
    ];
    if (siblings.length > 0) {
        lines.push("", prompt.slot(RECIPE_PROBE_USER_TEMPLATE_KEY, "siblingAssignments"));
        lines.push(...siblings.map((one) => `- ${one.probe}: ${one.question}`));
    }
    return lines.join("\n");
}

/** 실행에 실을 계약의 판이며 실행은 원장 없이 이 값을 그대로 쓴다. */
export function resolveRecipePromptPin(prompt: AgentPrompt): ResolvedAgentPrompt {
    return {
        promptVersion: prompt.version(),
        toolContractVersion: RECIPE_TOOL_CONTRACT.version,
    };
}
