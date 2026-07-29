import {
    computeResolvedPromptBundleHash,
    type AgentPromptBundle,
    type ResolvedAgentPrompt,
} from "@tracer-agent/llm";
import { AGENT } from "~agent-worker/support/agent.const.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import { renderPromptFragment, type PromptFragmentDefault } from "~agent-worker/support/prompt.fragment.js";
import type { PromptFragmentRunResolver } from "~agent-worker/support/resolved.prompt.fragments.js";
import { RECIPE_CANDIDATE_LIMIT } from "./recipe.const.js";
import {
    MAX_PROBE_WEIGHT,
    MAX_REDISPATCH_PROBES,
    MAX_REDISPATCH_ROUNDS,
    type DispatchPlan,
    type ProbeReport,
} from "./recipe.dispatch.schema.js";
import { languageDirective } from "./recipe.language.js";
import {
    RECIPE_CANDIDATE_BUDGET,
    RECIPE_CITATION_DISCIPLINE,
    RECIPE_DEFINITION,
    RECIPE_DISPATCH_WEIGHTING,
    RECIPE_EMPTY_PLAN,
    RECIPE_EVIDENCE_SOURCING,
    RECIPE_INVESTIGATOR_REPAIR_TEMPLATE_KEY,
    RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
    RECIPE_OUTPUT_FIELDS,
    RECIPE_PROBE_SYSTEM_TEMPLATE_KEY,
    RECIPE_PROMPT_FRAGMENT_BINDINGS,
    RECIPE_QUALITY_RULES,
    RECIPE_REDISPATCH_PROTOCOL,
    RECIPE_REPAIR_DIRECTIVE,
    RECIPE_SPECIALIST_CATALOG,
    RECIPE_SPECIALIST_CHARTER,
    RECIPE_SPECIALIST_REPORTING,
    RECIPE_SURVEY_SYSTEM_TEMPLATE_KEY,
    RECIPE_TURN_SPLITTING,
} from "./recipe.prompt.fragments.js";
import { RECIPE_SCAN_TOOL } from "./recipe.tool.schema.js";

/** 이 번들이 바뀔 때마다 사람이 올리는 표시이며 기동 검사가 이 값을 원장의 채널과 대조한다. */
export const RECIPE_PROMPT_VERSION = "v1";

const TOOL_CONTRACT_VERSION = "1";
const OUTPUT_SCHEMA_VERSION = "1";

/** 조각이 말하는 상한과 이 구현이 스키마로 강제하는 상한이 갈라지면 프롬프트가 거짓을 말한다. */
export const RECIPE_PROMPT_PLACEHOLDERS = {
    recipeCandidateLimit: RECIPE_CANDIDATE_LIMIT,
    maxRedispatchProbes: MAX_REDISPATCH_PROBES,
    maxRedispatchRounds: MAX_REDISPATCH_ROUNDS,
    maxProbeWeight: MAX_PROBE_WEIGHT,
    checkCitationsTool: RECIPE_SCAN_TOOL.checkCitations,
} as const;

function renderFragment(
    value: PromptFragmentDefault,
    templateKey: string,
    resolver?: PromptFragmentRunResolver,
): string {
    const binding = RECIPE_PROMPT_FRAGMENT_BINDINGS.find(
        (entry) => entry.templateKey === templateKey && entry.fragment === value,
    );
    if (binding === undefined) throw new Error(`prompt-fragment.binding-missing:${value.codeName}`);
    return (
        resolver?.resolve(templateKey, binding.fragmentSlot, value, RECIPE_PROMPT_PLACEHOLDERS)
        ?? renderPromptFragment(value, RECIPE_PROMPT_PLACEHOLDERS)
    );
}

/** 도구 접두사가 붙지 않은, 조율자가 읽는 기준 시스템 프롬프트다. */
export function buildRecipeSystemPrompt(resolver?: PromptFragmentRunResolver): string {
    const fragment = (value: PromptFragmentDefault): string =>
        renderFragment(value, RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY, resolver);
    return [
        `You turn one user-selected coding-agent task into reusable "recipes".`,
        "",
        fragment(RECIPE_DEFINITION),
        "",
        fragment(RECIPE_EVIDENCE_SOURCING),
        "",
        "How to work:",
        fragment(RECIPE_TURN_SPLITTING),
        "",
        fragment(RECIPE_CITATION_DISCIPLINE),
        "",
        fragment(RECIPE_CANDIDATE_BUDGET),
        "",
        fragment(RECIPE_REDISPATCH_PROTOCOL),
        "",
        fragment(RECIPE_OUTPUT_FIELDS),
        "",
        "Rules:",
        fragment(RECIPE_QUALITY_RULES),
        "",
        "Return the recipes as structured output conforming to the provided schema.",
    ].join("\n");
}

/** 근거 검증에 걸린 출력을 모델에게 돌려줘 한 번 고쳐 받는 지시문이며 직전 출력을 함께 싣는다. */
export function buildRecipeRepairPrompt(
    basePrompt: string,
    previousOutput: unknown,
    errors: readonly string[],
    resolver?: PromptFragmentRunResolver,
): string {
    return [
        basePrompt,
        "",
        "Your previous output:",
        JSON.stringify(previousOutput),
        "",
        "Deterministic provenance validation rejected your output:",
        ...errors.map((error) => `  - ${error}`),
        "",
        buildRecipeRepairDirective(resolver),
    ].join("\n");
}

export function buildRecipeRepairDirective(resolver?: PromptFragmentRunResolver): string {
    return renderFragment(RECIPE_REPAIR_DIRECTIVE, RECIPE_INVESTIGATOR_REPAIR_TEMPLATE_KEY, resolver);
}

export function buildRecipeUserPrompt(
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
        `Output language: ${languageDirective(AGENT.recipeScan.id, language)}`,
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

export function buildRecipeSurveySystemPrompt(resolver?: PromptFragmentRunResolver): string {
    const fragment = (value: PromptFragmentDefault): string =>
        renderFragment(value, RECIPE_SURVEY_SYSTEM_TEMPLATE_KEY, resolver);
    return [
        "You plan one recipe-scan investigation before it starts.",
        "",
        fragment(RECIPE_SPECIALIST_CATALOG),
        "",
        fragment(RECIPE_DISPATCH_WEIGHTING),
        "",
        fragment(RECIPE_EMPTY_PLAN),
    ].join("\n");
}

export function buildRecipeSurveyPrompt(
    taskId: string,
    userPrompt: string | undefined,
    availableTurns: number,
): string {
    const lines = [
        `Anchor task ID: ${taskId}`,
        `Investigation turns available in total: ${availableTurns}`,
    ];
    if (userPrompt !== undefined && userPrompt.trim().length > 0) {
        lines.push(`What the user asked for: ${userPrompt.trim()}`);
    }
    return lines.join("\n");
}

// 예산 소진을 무엇으로 세는지는 실행 기계가 소유하므로 마지막 문장만 이 구현이 쓴다.
export function buildRecipeProbeSystemPrompt(resolver?: PromptFragmentRunResolver): string {
    const fragment = (value: PromptFragmentDefault): string =>
        renderFragment(value, RECIPE_PROBE_SYSTEM_TEMPLATE_KEY, resolver);
    return [
        "You are one specialist in a recipe-scan investigation.",
        "",
        fragment(RECIPE_SPECIALIST_CHARTER),
        "",
        fragment(RECIPE_SPECIALIST_REPORTING),
        "If your turns run out with the question still open, say so in exhausted so the coordinator can",
        "decide whether to spend more.",
    ].join("\n");
}

export function buildRecipeProbePrompt(taskId: string, question: string, turns: number): string {
    return [
        `Anchor task ID: ${taskId}`,
        `Your question: ${question}`,
        `Turns available: ${turns}`,
    ].join("\n");
}

/** 실행에 실을 이 번들의 코드 고정값이며 실행은 원장 없이 이 값을 그대로 쓴다. */
export function resolveRecipePromptPin(language: OutputLanguage): ResolvedAgentPrompt {
    const bundle: AgentPromptBundle = {
        investigatorSystemPrompt: buildRecipeSystemPrompt(),
        probeSystemPrompt: buildRecipeProbeSystemPrompt(),
        surveySystemPrompt: buildRecipeSurveySystemPrompt(),
    };
    return {
        versionId: `recipe-scan:${language}:${RECIPE_PROMPT_VERSION}`,
        semanticVersion: RECIPE_PROMPT_VERSION,
        contentHash: computeResolvedPromptBundleHash(bundle).resolvedPromptHash,
        toolContractVersion: TOOL_CONTRACT_VERSION,
        outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
    };
}
