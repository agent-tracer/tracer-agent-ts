import {
    computeResolvedPromptBundleHash,
    type AgentPromptBundle,
    type ResolvedAgentPrompt,
} from "@tracer-agent/llm";
import type { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import type { InspectReport } from "./cleanup.dispatch.schema.js";

export const CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY = "task-cleanup.investigator.system" as const;
export const CLEANUP_INVESTIGATOR_REPAIR_TEMPLATE_KEY = "task-cleanup.investigator.repair" as const;
export const CLEANUP_TRIAGE_SYSTEM_TEMPLATE_KEY = "task-cleanup.triage.system" as const;
export const CLEANUP_INSPECT_SYSTEM_TEMPLATE_KEY = "task-cleanup.inspect.system" as const;

/** 이 번들이 바뀔 때마다 사람이 올리는 표시이며, 부트가 이 값과 원장 production 채널의 semantic version을 대조한다. */
export const CLEANUP_PROMPT_VERSION = "v1";
const TOOL_CONTRACT_VERSION = "1";
const OUTPUT_SCHEMA_VERSION = "1";

// 프롬프트 캐시는 접두사 일치라 시스템 프롬프트에 요청마다 바뀌는 값이 섞이면 매 요청 무효화된다.
export function buildCleanupSystemPrompt(prompt: AgentPrompt, language: OutputLanguage): string {
    const slot = (name: string): string => prompt.slot(CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY, name);
    return [
        "You are the coordinator of a task-cleanup scan for Agent Tracer, an observability tool that",
        "records coding-agent sessions.",
        "",
        "Your job is to decide which of the server's cleanup candidates should be **archived**, and to",
        "write one short rationale for each.",
        slot("reviewGuarantee"),
        "",
        slot("reviewerSourcing"),
        "",
        "Evidence discipline. This is the rule that matters:",
        slot("evidenceDiscipline"),
        "",
        "Rules:",
        slot("suggestionRules"),
        "",
        slot("redispatchProtocol"),
        "",
        `Output language: ${prompt.languageDirective(language)}`,
        "",
        "Return the suggestions as structured output conforming to the provided schema.",
    ].join("\n");
}

/** 근거 검증에 걸린 출력을 모델에게 돌려줘 한 번 고쳐 받는 지시문이며, 실행기가 대화를 잇지 않으므로 직전 출력을 함께 싣는다. */
export function buildCleanupRepairPrompt(
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
        "Deterministic provenance validation rejected part of your output:",
        ...errors.map((error) => `  - ${error}`),
        "",
        prompt.slot(CLEANUP_INVESTIGATOR_REPAIR_TEMPLATE_KEY, "repairDirective"),
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

export function buildCleanupTriageSystemPrompt(prompt: AgentPrompt): string {
    const slot = (name: string): string => prompt.slot(CLEANUP_TRIAGE_SYSTEM_TEMPLATE_KEY, name);
    return [
        "You open the cleanup scan by choosing which candidates to hand to reviewers.",
        "",
        slot("candidateFields"),
        "",
        slot("triagePolicy"),
        "",
        slot("inspectWeighting"),
    ].join("\n");
}

export function buildCleanupTriagePrompt(candidateCount: number): string {
    return [
        `Candidates in this batch: ${candidateCount}`,
        "Call list_candidate_tasks to see them before deciding.",
    ].join("\n");
}

export function buildCleanupInspectSystemPrompt(prompt: AgentPrompt): string {
    return [
        "You judge one cleanup candidate by reading what actually happened in it.",
        "",
        prompt.slot(CLEANUP_INSPECT_SYSTEM_TEMPLATE_KEY, "reviewerCharter"),
    ].join("\n");
}

export function buildCleanupInspectPrompt(taskId: string, turns: number): string {
    return [`Task to judge: ${taskId}`, `Turns available: ${turns}`].join("\n");
}

/** claude-sdk 실행에 실을 이 번들의 코드 pin이며, 실행은 이 값을 원장 없이 그대로 쓰고 부트만 원장과 대조한다. */
export function resolveCleanupPromptPin(
    prompt: AgentPrompt,
    language: OutputLanguage,
): ResolvedAgentPrompt {
    const bundle: AgentPromptBundle = {
        investigatorSystemPrompt: buildCleanupSystemPrompt(prompt, language),
        triageSystemPrompt: buildCleanupTriageSystemPrompt(prompt),
        inspectSystemPrompt: buildCleanupInspectSystemPrompt(prompt),
    };
    return {
        versionId: `task-cleanup:${language}:${CLEANUP_PROMPT_VERSION}`,
        semanticVersion: CLEANUP_PROMPT_VERSION,
        contentHash: computeResolvedPromptBundleHash(bundle).resolvedPromptHash,
        toolContractVersion: TOOL_CONTRACT_VERSION,
        outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
    };
}
