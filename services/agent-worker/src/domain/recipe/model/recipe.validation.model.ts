import { RECIPE_CANDIDATE_LIMIT } from "./recipe.tool.schema.js";
import {
    isEventVerified,
    isEventVerifiedAnyTask,
    isRuleVerified,
    isTurnVerified,
    verifiedRecipeRev,
    type ProvenanceSnapshot,
} from "./recipe.provenance.model.js";
import type { RecipeCandidatePayload } from "./recipe.scan.schema.js";

/** 모델이 낸 후보가 이 실행에서 관측한 근거만 인용하는지 검사하며 오류는 모델에게 돌려줄 문장이다. */
export function validateRecipeCandidates(
    candidates: readonly RecipeCandidatePayload[],
    anchorTaskId: string,
    provenance: ProvenanceSnapshot,
): readonly string[] {
    // 근거가 없으면 후보를 내지 않는 것이 옳은 답이므로 빈 출력은 오류가 아니다.
    if (candidates.length === 0) return [];
    if (candidates.length > RECIPE_CANDIDATE_LIMIT) {
        return [`At most ${RECIPE_CANDIDATE_LIMIT} recipe candidates may be returned.`];
    }
    const errors = candidates.flatMap((candidate, index) =>
        validateRecipeCandidate(candidate, anchorTaskId, provenance).map(
            (error) => `Recipe ${index + 1}: ${error}`,
        ),
    );
    return [...errors, ...duplicateTurnErrors(candidates)];
}

/** 두 구현체가 같은 문장을 돌려주려면 걸린 ID 목록의 중복과 순서가 같아야 한다. */
function unsupported(cited: readonly string[], verified: (id: string) => boolean): readonly string[] {
    return [...new Set(cited)].filter((id) => !verified(id)).sort();
}

function duplicateTurnErrors(candidates: readonly RecipeCandidatePayload[]): readonly string[] {
    const claimed = new Map<string, number>();
    const errors: string[] = [];
    candidates.forEach((candidate, index) => {
        const position = index + 1;
        for (const slice of candidate.contributing_slices) {
            for (const turnId of slice.turnIds) {
                const key = `${slice.taskId} ${turnId}`;
                const owner = claimed.get(key) ?? position;
                claimed.set(key, owner);
                if (owner !== position) {
                    errors.push(`Recipe ${position}: turn ${turnId} was already claimed by recipe ${owner}.`);
                }
            }
        }
    });
    return errors;
}

function validateRecipeCandidate(
    candidate: RecipeCandidatePayload,
    anchorTaskId: string,
    provenance: ProvenanceSnapshot,
): readonly string[] {
    const errors: string[] = [];
    // 같은 앵커 태스크를 여러 조각으로 쪼갠 후보도 있으므로 첫 조각이 아니라 그 조각들의 합집합을 본다.
    const anchorEventIds = candidate.contributing_slices
        .filter((slice) => slice.taskId === anchorTaskId)
        .flatMap((slice) => slice.eventIds);
    if (!candidate.contributing_slices.some((slice) => slice.taskId === anchorTaskId)) {
        errors.push(`contributing_slices must include anchor task ${anchorTaskId}.`);
    } else if (anchorEventIds.length === 0) {
        errors.push("The anchor contributing slice must cite at least one anchor event ID.");
    }

    const citedEventIds: string[] = [];
    for (const slice of candidate.contributing_slices) {
        if (provenance.eventIdsByTask[slice.taskId] === undefined) {
            errors.push(`Unsupported contributing task ID: ${slice.taskId}.`);
        }
        const unknownTurns = unsupported(slice.turnIds, (turnId) =>
            isTurnVerified(provenance, slice.taskId, turnId),
        );
        if (unknownTurns.length > 0) {
            errors.push(`Unsupported turn IDs for task ${slice.taskId}: ${unknownTurns.join(", ")}.`);
        }
        const unknownEvents = unsupported(slice.eventIds, (id) =>
            isEventVerified(provenance, slice.taskId, id),
        );
        if (unknownEvents.length > 0) {
            errors.push(`Unsupported event IDs for task ${slice.taskId}: ${unknownEvents.join(", ")}.`);
        }
        citedEventIds.push(...slice.eventIds);
    }
    if (citedEventIds.length === 0) {
        errors.push("At least one representative event ID must be cited in contributing_slices.");
    }

    candidate.corrections.forEach((correction, index) => {
        const unknown = unsupported(correction.evidence, (id) => isEventVerifiedAnyTask(provenance, id));
        if (unknown.length > 0) {
            errors.push(`Correction ${index + 1} cites unsupported event IDs: ${unknown.join(", ")}.`);
        }
    });
    candidate.pitfalls.forEach((pitfall, index) => {
        const unknown = unsupported(pitfall.evidence, (id) => isEventVerifiedAnyTask(provenance, id));
        if (unknown.length > 0) {
            errors.push(`Pitfall ${index + 1} cites unsupported event IDs: ${unknown.join(", ")}.`);
        }
    });
    candidate.recovery.forEach((recovery, index) => {
        const unknown = unsupported(recovery.evidence, (id) => isEventVerifiedAnyTask(provenance, id));
        if (unknown.length > 0) {
            errors.push(`Recovery ${index + 1} cites unsupported event IDs: ${unknown.join(", ")}.`);
        }
    });
    // 근거를 적지 않은 단계는 관측되지 않았다는 뜻이므로 검사할 것이 없다.
    candidate.steps.forEach((step, index) => {
        const unknown = unsupported(step.evidence, (id) => isEventVerifiedAnyTask(provenance, id));
        if (unknown.length > 0) {
            errors.push(`Step ${index + 1} cites unsupported event IDs: ${unknown.join(", ")}.`);
        }
    });

    const unknownRules = unsupported(candidate.governing_rules, (ruleId) =>
        isRuleVerified(provenance, ruleId),
    );
    if (unknownRules.length > 0) {
        errors.push(`Unsupported governing rule IDs: ${unknownRules.join(", ")}.`);
    }
    const revises = candidate.revises_recipe_id;
    if (revises !== undefined && revises !== null && verifiedRecipeRev(provenance, revises) === undefined) {
        errors.push(`Unsupported revises_recipe_id: ${revises}.`);
    }
    return errors;
}
