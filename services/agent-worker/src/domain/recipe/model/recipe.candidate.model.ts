import {
    isEventVerified,
    isEventVerifiedAnyTask,
    isRuleVerified,
    isTurnVerified,
    verifiedRecipeRev,
    type ProvenanceSnapshot,
} from "./recipe.provenance.model.js";
import type {
    RecipeCandidatePayload,
    RecipeCorrectionPayload,
    RecipePitfallPayload,
    RecipeRecoveryPayload,
    RecipeSlicePayload,
    RecipeStepPayload,
    RecipeTouchedFilePayload,
} from "./recipe.scan.schema.js";

/** 산출물 창구로 보낼 수 있는 형태로 조립된 레시피 후보이며 식별자와 상태와 판은 창구가 정한다. */
export interface GeneratedRecipeCandidate {
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly request: string;
    readonly useWhen: readonly string[];
    readonly inputs: readonly string[];
    readonly outputs: readonly string[];
    readonly corrections: readonly RecipeCorrectionPayload[];
    readonly pitfalls: readonly RecipePitfallPayload[];
    readonly recovery: readonly RecipeRecoveryPayload[];
    readonly governingRules: readonly string[];
    readonly steps: readonly RecipeStepPayload[];
    readonly touchedFiles: readonly RecipeTouchedFilePayload[];
    readonly contributingSlices: readonly RecipeSlicePayload[];
    readonly rationale: string;
    readonly parentRecipeId?: string;
    /** 모델이 검색으로 관측한 부모 레시피의 판이며 지금 판과 어긋나면 창구가 부모를 비운다. */
    readonly parentRecipeSeenRev?: number;
}

interface ProvenanceFilterResult {
    readonly contributingSlices: readonly RecipeSlicePayload[];
    readonly corrections: readonly RecipeCorrectionPayload[];
    readonly pitfalls: readonly RecipePitfallPayload[];
    readonly recovery: readonly RecipeRecoveryPayload[];
    readonly steps: readonly RecipeStepPayload[];
    readonly governingRules: readonly string[];
    readonly parentRecipeId?: string;
    readonly parentRecipeSeenRev?: number;
}

/** 이 실행의 장부가 확인한 이벤트 인용만 남긴다. */
function verifiedEvidence(provenance: ProvenanceSnapshot, evidence: readonly string[]): string[] {
    return evidence.filter((eventId) => isEventVerifiedAnyTask(provenance, eventId));
}

/** 사용자 소유가 아닌 태스크 인용과 이 실행의 장부에 없는 ID 인용을 제거한다. */
export function filterCandidateByProvenance(
    candidate: RecipeCandidatePayload,
    ownedTaskIds: ReadonlySet<string>,
    provenance: ProvenanceSnapshot,
): ProvenanceFilterResult | null {
    const contributingSlices = candidate.contributing_slices
        .filter((slice) => ownedTaskIds.has(slice.taskId))
        .map((slice) => ({
            taskId: slice.taskId,
            turnIds: slice.turnIds.filter((turnId) => isTurnVerified(provenance, slice.taskId, turnId)),
            eventIds: slice.eventIds.filter((eventId) => isEventVerified(provenance, slice.taskId, eventId)),
        }));
    if (contributingSlices.length === 0) return null;

    const corrections = candidate.corrections
        .map((correction) => ({ ...correction, evidence: verifiedEvidence(provenance, correction.evidence) }))
        .filter((correction) => correction.evidence.length > 0);

    const pitfalls = candidate.pitfalls
        .map((pitfall) => ({ ...pitfall, evidence: verifiedEvidence(provenance, pitfall.evidence) }))
        .filter((pitfall) => pitfall.evidence.length > 0);

    // 복구는 지적과 같은 근거를 요구하므로 근거가 남지 않은 항목은 지적과 같이 뺀다.
    const recovery = candidate.recovery
        .map((entry) => ({ ...entry, evidence: verifiedEvidence(provenance, entry.evidence) }))
        .filter((entry) => entry.evidence.length > 0);

    // 단계는 근거 없이도 서므로 인용만 걸러 내고 단계 자체는 남긴다.
    const steps = candidate.steps.map((step) => ({
        ...step,
        evidence: verifiedEvidence(provenance, step.evidence),
    }));

    const governingRules = candidate.governing_rules.filter((ruleId) => isRuleVerified(provenance, ruleId));

    const parentRecipeId = candidate.revises_recipe_id ?? undefined;
    const seenRev = parentRecipeId !== undefined ? verifiedRecipeRev(provenance, parentRecipeId) : undefined;

    return {
        contributingSlices,
        corrections,
        pitfalls,
        recovery,
        steps,
        governingRules,
        ...(parentRecipeId !== undefined && seenRev !== undefined
            ? { parentRecipeId, parentRecipeSeenRev: seenRev }
            : {}),
    };
}

/** 모델이 낸 후보를 근거로 걸러 저장 가능한 후보로 조립한다. */
export function assembleRecipeCandidates(
    candidates: readonly RecipeCandidatePayload[],
    ownedTaskIds: ReadonlySet<string>,
    provenance: ProvenanceSnapshot,
): readonly GeneratedRecipeCandidate[] {
    const assembled: GeneratedRecipeCandidate[] = [];
    for (const candidate of candidates) {
        const filtered = filterCandidateByProvenance(candidate, ownedTaskIds, provenance);
        if (filtered === null) continue;
        assembled.push({
            title: candidate.title,
            intent: candidate.intent,
            description: candidate.description,
            summaryMd: candidate.summary_md,
            request: candidate.request,
            useWhen: candidate.use_when,
            inputs: candidate.inputs,
            outputs: candidate.outputs,
            corrections: filtered.corrections,
            pitfalls: filtered.pitfalls,
            recovery: filtered.recovery,
            governingRules: filtered.governingRules,
            steps: filtered.steps,
            touchedFiles: candidate.touched_files,
            contributingSlices: filtered.contributingSlices,
            rationale: candidate.rationale,
            ...(filtered.parentRecipeId !== undefined
                ? {
                    parentRecipeId: filtered.parentRecipeId,
                    parentRecipeSeenRev: filtered.parentRecipeSeenRev,
                }
                : {}),
        });
    }
    return assembled;
}

/** 완료 알림에 실을 요약 문장이다. */
export function recipeScanSummary(candidatesCreated: number): string {
    if (candidatesCreated === 0) return "No recipe candidates produced";
    return `${candidatesCreated} recipe ${candidatesCreated === 1 ? "candidate" : "candidates"}`;
}
