import type { ResolvedAgentPrompt } from "@tracer-agent/llm";
import type { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import type { CleanupBatch, CleanupCandidate } from "./cleanup.candidate.model.js";
import {
    MAX_INSPECT_EXCERPTS,
    MAX_INSPECT_REASON_CHARS,
    type InspectReport,
} from "./cleanup.dispatch.schema.js";
import { CLEANUP_TOOL_CONTRACT, TRIAGE_CANDIDATE_LIST_LIMIT } from "./cleanup.tool.schema.js";

export const CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY = "task-cleanup.investigator.system" as const;
export const CLEANUP_INVESTIGATOR_REPAIR_TEMPLATE_KEY = "task-cleanup.investigator.repair" as const;
export const CLEANUP_TRIAGE_SYSTEM_TEMPLATE_KEY = "task-cleanup.triage.system" as const;
export const CLEANUP_INSPECT_SYSTEM_TEMPLATE_KEY = "task-cleanup.inspect.system" as const;
export const CLEANUP_TRIAGE_USER_TEMPLATE_KEY = "task-cleanup.triage.user" as const;


// 프롬프트 캐시는 접두사 일치라 시스템 프롬프트에 요청마다 바뀌는 값이 섞이면 매 요청 무효화된다.
export function buildCleanupSystemPrompt(prompt: AgentPrompt): string {
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
    prompt: AgentPrompt,
    maxSuggestions: number,
    scannedAt: string,
    language: OutputLanguage,
    reports: readonly InspectReport[] = [],
): string {
    const lines = [
        `Scan time: ${scannedAt}`,
        `Propose at most ${maxSuggestions} archive suggestions.`,
        "",
        `Output language: ${prompt.languageDirective(language)}`,
    ];
    return lines.join("\n") + renderInspectReports(reports);
}

/** 후보별 검토 전문가가 올린 판정을 결정 호출이 읽을 근거로 정리한다. */
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

/** 서버가 선별한 후보를 요청이 직접 실어, 조율자가 되읽지 않고 고르게 한다. */
export function buildCleanupTriagePrompt(
    prompt: AgentPrompt,
    batch: CleanupBatch,
    limit: number = TRIAGE_CANDIDATE_LIST_LIMIT,
): { readonly text: string; readonly listed: readonly CleanupCandidate[] } {
    const slot = (name: string): string => prompt.slot(CLEANUP_TRIAGE_USER_TEMPLATE_KEY, name);
    const listed = batch.candidates.slice(0, limit);
    const lines = [`Candidates in this batch: ${batch.candidates.length}`];
    if (listed.length > 0) {
        lines.push("", slot("candidateList"), ...listed.map(candidateLine));
    }
    if (batch.candidates.length > listed.length || batch.batchTruncated) {
        lines.push("", slot("candidateOverflow"));
    }
    return { text: lines.join("\n"), listed };
}

/** 후보 하나가 조율자에게 보이는 한 줄이며 제목은 구분자를 담을 수 있어 뒤에 둔다. */
function candidateLine(candidate: CleanupCandidate): string {
    const reasons = candidate.candidateReasons.join(", ");
    return (
        `- ${candidate.id} | ${candidate.status}` +
        ` | events: ${candidate.hasEvents ? "yes" : "no"}` +
        ` | last: ${candidate.lastEventAt ?? "none"}` +
        ` | reasons: ${reasons}` +
        ` | title: ${candidate.visibleTitle}`
    );
}

export function buildCleanupInspectSystemPrompt(prompt: AgentPrompt): string {
    return [
        "You judge one cleanup candidate by reading what actually happened in it.",
        "",
        prompt.slot(CLEANUP_INSPECT_SYSTEM_TEMPLATE_KEY, "reviewerCharter"),
    ].join("\n");
}

// 상한을 거절로만 알리면 검토자가 근거를 모으고도 보고가 버려지므로 자기 보고의 상한을 함께 준다.
export function buildCleanupInspectPrompt(taskId: string, turns: number): string {
    return [
        `Task to judge: ${taskId}`,
        `Turns available: ${turns}`,
        `Keep your reason under ${MAX_INSPECT_REASON_CHARS} characters`
        + ` and cite at most ${MAX_INSPECT_EXCERPTS} event IDs.`,
    ].join("\n");
}

/** 실행에 실을 계약의 판이며 실행은 원장 없이 이 값을 그대로 쓴다. */
export function resolveCleanupPromptPin(prompt: AgentPrompt): ResolvedAgentPrompt {
    return {
        promptVersion: prompt.version(),
        toolContractVersion: CLEANUP_TOOL_CONTRACT.version,
    };
}
