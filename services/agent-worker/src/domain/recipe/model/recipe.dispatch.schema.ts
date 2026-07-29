import { z } from "zod";
import { recipeCandidatesListSchema } from "./recipe.scan.schema.js";

// 조사를 조율자와 전문가로 나눌 때만 쓰는 내부 계획과 보고 스키마이며, 계약이 잠그는
// 도구와 출력과 예산 계약과는 분리된 오케스트레이션 지식이다.

export const RECIPE_PROBE_NAMES = ["timeline", "rules", "repetition"] as const;

export type RecipeProbeName = (typeof RECIPE_PROBE_NAMES)[number];

export const MAX_PROBE_WEIGHT = 10;
export const MAX_DISPATCH_PROBES = 3;
export const MAX_PROBE_QUESTION_CHARS = 300;
export const MAX_EXCERPTS_PER_PROBE = 12;
export const MAX_EXCERPT_CHARS = 600;
export const MAX_VERDICT_CHARS = 1_200;

/** 조율자가 종합 대신 전문가를 다시 부를 수 있는 라운드 수이며 무한 순환을 이 값으로 막는다. */
export const MAX_REDISPATCH_ROUNDS = 1;

/** 한 번의 추가 파견 요청이 부를 수 있는 전문가 수의 상한이다. */
export const MAX_REDISPATCH_PROBES = 3;

export const probeAssignmentSchema = z.object({
    probe: z.enum(RECIPE_PROBE_NAMES),
    weight: z.number().int().min(1).max(MAX_PROBE_WEIGHT),
    question: z.string().trim().min(1).max(MAX_PROBE_QUESTION_CHARS),
});

// 계획이 비면 조사할 것이 없다는 뜻이며 조율자는 근거를 모을 도구가 없으므로 빈 결과로 끝난다.
export const dispatchPlanSchema = z.object({
    probes: z.array(probeAssignmentSchema).max(MAX_DISPATCH_PROBES).default([]),
});

export const recipeExcerptSchema = z.object({
    taskId: z.string().trim().min(1),
    eventId: z.string().trim().min(1),
    text: z.string().trim().min(1).max(MAX_EXCERPT_CHARS),
});

export const probeReportSchema = z.object({
    probe: z.enum(RECIPE_PROBE_NAMES),
    verdict: z.string().trim().min(1).max(MAX_VERDICT_CHARS),
    excerpts: z.array(recipeExcerptSchema).max(MAX_EXCERPTS_PER_PROBE).default([]),
    exhausted: z.boolean().default(false),
});

export const recipeSynthesisSchema = recipeCandidatesListSchema.extend({
    redispatch: z.array(probeAssignmentSchema).max(MAX_REDISPATCH_PROBES).default([]),
});

export type ProbeAssignment = z.infer<typeof probeAssignmentSchema>;
export type DispatchPlan = z.infer<typeof dispatchPlanSchema>;
export type RecipeExcerpt = z.infer<typeof recipeExcerptSchema>;
export type ProbeReport = z.infer<typeof probeReportSchema>;
export type RecipeSynthesis = z.infer<typeof recipeSynthesisSchema>;

export function totalPlanWeight(plan: DispatchPlan): number {
    return plan.probes.reduce((sum, probe) => sum + probe.weight, 0);
}
