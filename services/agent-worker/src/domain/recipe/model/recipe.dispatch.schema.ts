import { z } from "zod";
import {
    RECIPE_PROBE_NAMES,
    probeAssignmentSchema,
    recipeCandidatesListSchema,
    type ProbeAssignment,
    type RecipeProbeName,
} from "./recipe.scan.schema.js";
import { MAX_REDISPATCH_PROBES, MAX_REDISPATCH_ROUNDS, probeDepthShare } from "./recipe.tool.schema.js";

export {
    MAX_REDISPATCH_PROBES,
    MAX_REDISPATCH_ROUNDS,
    RECIPE_PROBE_NAMES,
    probeAssignmentSchema,
    probeDepthShare,
};
export type { ProbeAssignment, RecipeProbeName };

// 조사를 조율자와 전문가로 나눌 때만 쓰는 내부 계획과 보고 스키마이며, 최종 출력이 계약으로
// 고정하는 recipes·redispatch 모양은 recipe.scan.schema.ts가 갖는다.

export const MAX_DISPATCH_PROBES = 3;
export const MAX_EXCERPTS_PER_PROBE = 12;
export const MAX_EXCERPT_CHARS = 600;
export const MAX_VERDICT_CHARS = 1_200;

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

/** 종합과 수리가 함께 쓰는 최종 출력 스키마이며 recipes와 redispatch의 배타는 계약이 소유한다. */
export const recipeSynthesisSchema = recipeCandidatesListSchema;

export type DispatchPlan = z.infer<typeof dispatchPlanSchema>;
export type RecipeExcerpt = z.infer<typeof recipeExcerptSchema>;
export type ProbeReport = z.infer<typeof probeReportSchema>;
export type RecipeSynthesis = z.infer<typeof recipeSynthesisSchema>;

export function totalPlanShare(plan: DispatchPlan): number {
    return plan.probes.reduce((sum, probe) => sum + probeDepthShare(probe.depth), 0);
}
