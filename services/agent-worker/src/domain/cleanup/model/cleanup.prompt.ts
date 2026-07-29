import {
    computeResolvedPromptBundleHash,
    type AgentPromptBundle,
    type ResolvedAgentPrompt,
} from "@tracer-agent/llm";
import { AGENT } from "~agent-worker/support/agent.const.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import { renderPromptFragment, type PromptFragmentDefault } from "~agent-worker/support/prompt.fragment.js";
import type { PromptFragmentRunResolver } from "~agent-worker/support/resolved.prompt.fragments.js";
import { CLEANUP_MAX_EVIDENCE_EVENT_IDS } from "./cleanup.suggestion.schema.js";
import { MAX_INSPECT_WEIGHT, MAX_REDISPATCH_ROUNDS, type InspectReport } from "./cleanup.dispatch.schema.js";
import { languageDirective } from "./cleanup.language.js";
import {
    CLEANUP_CANDIDATE_FIELDS,
    CLEANUP_EVIDENCE_DISCIPLINE,
    CLEANUP_INSPECT_SYSTEM_TEMPLATE_KEY,
    CLEANUP_INSPECT_WEIGHTING,
    CLEANUP_INVESTIGATOR_REPAIR_TEMPLATE_KEY,
    CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
    CLEANUP_PROMPT_FRAGMENT_BINDINGS,
    CLEANUP_REDISPATCH_PROTOCOL,
    CLEANUP_REPAIR_DIRECTIVE,
    CLEANUP_REVIEW_GUARANTEE,
    CLEANUP_REVIEWER_CHARTER,
    CLEANUP_REVIEWER_SOURCING,
    CLEANUP_SUGGESTION_RULES,
    CLEANUP_TRIAGE_POLICY,
    CLEANUP_TRIAGE_SYSTEM_TEMPLATE_KEY,
} from "./cleanup.prompt.fragments.js";

/** 이 번들이 바뀔 때마다 사람이 올리는 표시이며, 부트가 이 값과 원장 production 채널의 semantic version을 대조한다. */
export const CLEANUP_PROMPT_VERSION = "v1";
const TOOL_CONTRACT_VERSION = "1";
const OUTPUT_SCHEMA_VERSION = "1";

/** 계약이 소유한 자리표시자 값이 이 구현이 스키마로 강제하는 상한과 갈라지면 프롬프트가 거짓을 말한다. */
export const CLEANUP_PROMPT_PLACEHOLDERS = {
    maxRedispatchRounds: MAX_REDISPATCH_ROUNDS,
    maxInspectWeight: MAX_INSPECT_WEIGHT,
    maxEvidenceEventIds: CLEANUP_MAX_EVIDENCE_EVENT_IDS,
} as const;

function renderFragment(
    value: PromptFragmentDefault,
    templateKey: string,
    resolver?: PromptFragmentRunResolver,
): string {
    const binding = CLEANUP_PROMPT_FRAGMENT_BINDINGS.find(
        (entry) => entry.templateKey === templateKey && entry.fragment === value,
    );
    if (binding === undefined) throw new Error(`prompt-fragment.binding-missing:${value.codeName}`);
    return (
        resolver?.resolve(templateKey, binding.fragmentSlot, value, CLEANUP_PROMPT_PLACEHOLDERS)
        ?? renderPromptFragment(value, CLEANUP_PROMPT_PLACEHOLDERS)
    );
}

// 프롬프트 캐시는 접두사 일치라 시스템 프롬프트에 요청마다 바뀌는 값이 섞이면 매 요청 무효화된다.
export function buildCleanupSystemPrompt(language: OutputLanguage, resolver?: PromptFragmentRunResolver): string {
    const fragment = (value: PromptFragmentDefault): string =>
        renderFragment(value, CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY, resolver);
    return [
        "You are the coordinator of a task-cleanup scan for Agent Tracer, an observability tool that",
        "records coding-agent sessions.",
        "",
        "Your job is to decide which of the server's cleanup candidates should be **archived**, and to",
        "write one short rationale for each.",
        fragment(CLEANUP_REVIEW_GUARANTEE),
        "",
        fragment(CLEANUP_REVIEWER_SOURCING),
        "",
        "Evidence discipline. This is the rule that matters:",
        fragment(CLEANUP_EVIDENCE_DISCIPLINE),
        "",
        "Rules:",
        fragment(CLEANUP_SUGGESTION_RULES),
        "",
        fragment(CLEANUP_REDISPATCH_PROTOCOL),
        "",
        `Output language: ${languageDirective(AGENT.taskCleanup.id, language)}`,
        "",
        "Return the suggestions as structured output conforming to the provided schema.",
    ].join("\n");
}

/** 근거 검증에 걸린 출력을 모델에게 돌려줘 한 번 고쳐 받는 지시문이며, 실행기가 대화를 잇지 않으므로 직전 출력을 함께 싣는다. */
export function buildCleanupRepairPrompt(
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
        "Deterministic provenance validation rejected part of your output:",
        ...errors.map((error) => `  - ${error}`),
        "",
        renderFragment(CLEANUP_REPAIR_DIRECTIVE, CLEANUP_INVESTIGATOR_REPAIR_TEMPLATE_KEY, resolver),
    ].join("\n");
}

export function buildCleanupUserPrompt(
    maxSuggestions: number,
    scannedAt: string,
    reports: readonly InspectReport[] = [],
): string {
    const lines = [
        `Scan time: ${scannedAt}`,
        `Propose at most ${maxSuggestions} archive suggestions.`,
    ];
    return lines.join("\n") + renderInspectReports(reports);
}

/** 후보별 검토 전문가가 올린 판정을 결정 호출이 읽을 근거로 편다. */
function renderInspectReports(reports: readonly InspectReport[]): string {
    if (reports.length === 0) return "";
    const lines = reports.map(
        (report) =>
            `- ${report.taskId}: ${report.archivable ? "archivable" : "keep"} — ${report.reason}`
            + (report.citedEventIds.length > 0 ? ` (events: ${report.citedEventIds.join(", ")})` : ""),
    );
    return "\n\nWhat the cleanup candidate reviewers reported:\n" + lines.join("\n");
}

export function buildCleanupTriageSystemPrompt(resolver?: PromptFragmentRunResolver): string {
    const fragment = (value: PromptFragmentDefault): string =>
        renderFragment(value, CLEANUP_TRIAGE_SYSTEM_TEMPLATE_KEY, resolver);
    return [
        "You open the cleanup scan by choosing which candidates to hand to reviewers.",
        "",
        fragment(CLEANUP_CANDIDATE_FIELDS),
        "",
        fragment(CLEANUP_TRIAGE_POLICY),
        "",
        fragment(CLEANUP_INSPECT_WEIGHTING),
    ].join("\n");
}

export function buildCleanupTriagePrompt(candidateCount: number): string {
    return [
        `Candidates in this batch: ${candidateCount}`,
        "Call list_candidate_tasks to see them before deciding.",
    ].join("\n");
}

export function buildCleanupInspectSystemPrompt(resolver?: PromptFragmentRunResolver): string {
    return [
        "You judge one cleanup candidate by reading what actually happened in it.",
        "",
        renderFragment(CLEANUP_REVIEWER_CHARTER, CLEANUP_INSPECT_SYSTEM_TEMPLATE_KEY, resolver),
    ].join("\n");
}

export function buildCleanupInspectPrompt(taskId: string, turns: number): string {
    return [`Task to judge: ${taskId}`, `Turns available: ${turns}`].join("\n");
}

/** claude-sdk 실행에 실을 이 번들의 코드 pin이며, 실행은 이 값을 원장 없이 그대로 쓰고 부트만 원장과 대조한다. */
export function resolveCleanupPromptPin(language: OutputLanguage): ResolvedAgentPrompt {
    const bundle: AgentPromptBundle = {
        investigatorSystemPrompt: buildCleanupSystemPrompt(language),
        triageSystemPrompt: buildCleanupTriageSystemPrompt(),
        inspectSystemPrompt: buildCleanupInspectSystemPrompt(),
    };
    return {
        versionId: `task-cleanup:${language}:${CLEANUP_PROMPT_VERSION}`,
        semanticVersion: CLEANUP_PROMPT_VERSION,
        contentHash: computeResolvedPromptBundleHash(bundle).resolvedPromptHash,
        toolContractVersion: TOOL_CONTRACT_VERSION,
        outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
    };
}
