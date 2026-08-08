import { z } from "zod";
import {
    RECIPE_PROBE_NAMES,
    probeAssignmentSchema,
    recipeCandidatesListSchema,
    type ProbeAssignment,
    type RecipeProbeName,
} from "./recipe.scan.schema.js";
import {
    MAX_DISPATCH_PROBES,
    MAX_EXCERPTS_PER_PROBE,
    MAX_EXCERPT_CHARS,
    MAX_REDISPATCH_PROBES,
    MAX_REDISPATCH_ROUNDS,
    MAX_VERDICT_CHARS,
    probeDepthShare,
} from "./recipe.tool.schema.js";

export {
    MAX_DISPATCH_PROBES,
    MAX_EXCERPTS_PER_PROBE,
    MAX_EXCERPT_CHARS,
    MAX_REDISPATCH_PROBES,
    MAX_REDISPATCH_ROUNDS,
    MAX_VERDICT_CHARS,
    RECIPE_PROBE_NAMES,
    probeAssignmentSchema,
    probeDepthShare,
};
export type { ProbeAssignment, RecipeProbeName };

// 조사를 조율자와 전문가로 나눌 때만 쓰는 내부 계획과 보고 스키마이며, 최종 출력이 계약으로
// 고정하는 recipes·redispatch 모양은 recipe.scan.schema.ts가 갖는다.

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

/**
 * 상한을 넘겨 거절된 보고를 상한까지 잘라 다시 검증하며, 상한 외의 이유로
 * 스키마에 어긋난 보고는 검증을 통과하지 못해 null 이다.
 */
export function salvageProbeReport(probe: RecipeProbeName, raw: unknown): ProbeReport | null {
    if (raw === null || typeof raw !== "object") return null;
    const source = raw as Record<string, unknown>;
    const excerpts = Array.isArray(source["excerpts"]) ? source["excerpts"] : [];
    const parsed = probeReportSchema.safeParse({
        ...source,
        probe,
        verdict: clamped(source["verdict"], MAX_VERDICT_CHARS),
        excerpts: excerpts.slice(0, MAX_EXCERPTS_PER_PROBE).map(clampedExcerpt),
        // 잘라 낸 보고는 전문가가 스스로 닫지 못한 조사이므로 소진으로 적는다.
        exhausted: true,
    });
    return parsed.success ? parsed.data : null;
}

function clamped(value: unknown, max: number): unknown {
    return typeof value === "string" ? value.trim().slice(0, max) : value;
}

function clampedExcerpt(value: unknown): unknown {
    if (value === null || typeof value !== "object") return value;
    const excerpt = value as Record<string, unknown>;
    return { ...excerpt, text: clamped(excerpt["text"], MAX_EXCERPT_CHARS) };
}

export type DispatchPlan = z.infer<typeof dispatchPlanSchema>;
export type RecipeExcerpt = z.infer<typeof recipeExcerptSchema>;
export type ProbeReport = z.infer<typeof probeReportSchema>;
export type RecipeSynthesis = z.infer<typeof recipeSynthesisSchema>;

export function totalPlanShare(plan: DispatchPlan): number {
    return plan.probes.reduce((sum, probe) => sum + probeDepthShare(probe.depth), 0);
}
