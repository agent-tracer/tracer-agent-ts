import { z } from "zod";
import { cleanupSuggestionsListSchema } from "./cleanup.suggestion.schema.js";
import {
    CLEANUP_MAX_SUGGESTIONS,
    MAX_INSPECT_WEIGHT,
    MAX_REDISPATCH_ROUNDS,
} from "./cleanup.tool.schema.js";

export { MAX_INSPECT_WEIGHT, MAX_REDISPATCH_ROUNDS };

// SDK 백엔드가 조사를 조율자와 후보별 조사로 나눌 때만 쓰는 내부 계획·보고 스키마이며, 계약이
// 잠그는 도구·출력·예산 계약과는 분리된 오케스트레이션 지식이다.

export const MAX_INSPECT_EXCERPTS = 6;
export const MAX_INSPECT_REASON_CHARS = 400;


export const inspectAssignmentSchema = z.object({
    taskId: z.string().trim().min(1),
    weight: z.number().int().min(1).max(MAX_INSPECT_WEIGHT),
});

// 계획이 비면(inspect: []) 아무도 후보를 조회하지 않으므로 조율자에게 갈 보고가 없고, 근거 없는 제안은
// 검증에서 전부 걸리므로 그 실행은 빈 제안으로 끝난다.
export const triagePlanSchema = z.object({
    inspect: z.array(inspectAssignmentSchema).max(CLEANUP_MAX_SUGGESTIONS).default([]),
});

export const inspectReportSchema = z.object({
    taskId: z.string().trim().min(1),
    archivable: z.boolean(),
    reason: z.string().trim().min(1).max(MAX_INSPECT_REASON_CHARS),
    citedEventIds: z.array(z.string().trim().min(1)).max(MAX_INSPECT_EXCERPTS).default([]),
});

export const cleanupDecisionSchema = cleanupSuggestionsListSchema.extend({
    redispatch: z.array(inspectAssignmentSchema).max(CLEANUP_MAX_SUGGESTIONS).default([]),
});

export type InspectAssignment = z.infer<typeof inspectAssignmentSchema>;
export type TriagePlan = z.infer<typeof triagePlanSchema>;
export type InspectReport = z.infer<typeof inspectReportSchema>;
export type CleanupDecision = z.infer<typeof cleanupDecisionSchema>;

export function totalPlanWeight(plan: TriagePlan): number {
    return plan.inspect.reduce((sum, assignment) => sum + assignment.weight, 0);
}
