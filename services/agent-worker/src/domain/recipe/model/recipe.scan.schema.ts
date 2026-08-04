import { z } from "zod";
import { DISPATCH_DEPTHS } from "@tracer-agent/llm";
import { MAX_REDISPATCH_PROBES, RECIPE_CANDIDATE_LIMIT } from "./recipe.tool.schema.js";

export const RECIPE_PROBE_NAMES = ["timeline", "rules", "repetition"] as const;

export type RecipeProbeName = (typeof RECIPE_PROBE_NAMES)[number];

export const MAX_PROBE_QUESTION_CHARS = 300;

/** 전문가에게 추가 조사를 맡기는 배정 하나이며 최종 출력의 redispatch 칸이 이 모양을 담는다. */
export const probeAssignmentSchema = z.object({
    probe: z.enum(RECIPE_PROBE_NAMES),
    depth: z.enum(DISPATCH_DEPTHS),
    question: z.string().trim().min(1).max(MAX_PROBE_QUESTION_CHARS),
});

/** 스텝 하나의 이행을 원장 이벤트로 확인할 수 있게 하는 관측 가능한 신호다. */
const verifyCommandSchema = z.object({
    kind: z.literal("command"),
    commandMatches: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
});

const verifyPatternSchema = z.object({
    kind: z.literal("pattern"),
    pattern: z.string().trim().min(1).max(500),
});

const verifyActionSchema = z.object({
    kind: z.literal("action"),
    tool: z.enum(["command", "file-read", "file-write", "web"]),
});

const verifySchema = z.union([verifyCommandSchema, verifyPatternSchema, verifyActionSchema]);

const stepSchema = z.object({
    order: z.number().int().min(1).max(50),
    action: z.string().trim().min(1).max(200),
    rationale: z.string().trim().max(300).nullish(),
    verify: verifySchema.nullish(),
});

const correctionSchema = z.object({
    whatAgentDid: z.string().trim().min(1).max(500),
    howCorrected: z.string().trim().min(1).max(500),
    evidence: z.array(z.string().trim().min(1)).min(1).max(50),
});

const pitfallSchema = z.object({
    pitfall: z.string().trim().min(1).max(500),
    whyNonObvious: z.string().trim().min(1).max(500),
    evidence: z.array(z.string().trim().min(1)).min(1).max(50),
});

const touchedFileSchema = z.object({
    path: z.string().trim().min(1).max(500),
    role: z.enum(["read", "write", "both"]),
});

const sliceSchema = z.object({
    taskId: z.string().trim().min(1),
    turnIds: z.array(z.string().trim().min(1)).max(50).default([]),
    eventIds: z.array(z.string().trim().min(1)).max(200).default([]),
});

const candidateSchema = z.object({
    title: z.string().trim().min(1).max(120),
    intent: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(400),
    summary_md: z.string().trim().min(1).max(4000),
    request: z.string().trim().min(1).max(2000),
    corrections: z.array(correctionSchema).max(20).default([]),
    pitfalls: z.array(pitfallSchema).max(20).default([]),
    governing_rules: z.array(z.string().trim().min(1)).max(50).default([]),
    revises_recipe_id: z.string().trim().min(1).max(200).nullish(),
    // 절차의 순서가 곧 의미이므로 order는 1부터 빈칸 없이 이어져야 한다.
    steps: z
        .array(stepSchema)
        .max(20)
        .default([])
        .refine((steps) => steps.every((step, index) => step.order === index + 1), {
            message: "step order must start at 1 and run consecutively",
        }),
    touched_files: z.array(touchedFileSchema).max(30).default([]),
    contributing_slices: z.array(sliceSchema).min(1).max(20),
    rationale: z.string().trim().min(1).max(500),
});

/** 어느 구현체로 실행하든 스캔 한 번이 돌려주는 구조화 출력이며 모양은 계약이 소유한다. */
export const recipeCandidatesListSchema = z
    .object({
        recipes: z.array(candidateSchema).max(RECIPE_CANDIDATE_LIMIT).default([]),
        redispatch: z.array(probeAssignmentSchema).max(MAX_REDISPATCH_PROBES).default([]),
    })
    .refine((value) => value.recipes.length === 0 || value.redispatch.length === 0, {
        message: "recipes and redispatch cannot both be non-empty",
        path: ["redispatch"],
    });

export type RecipeStepPayload = z.infer<typeof stepSchema>;
export type RecipeCorrectionPayload = z.infer<typeof correctionSchema>;
export type RecipePitfallPayload = z.infer<typeof pitfallSchema>;
export type RecipeTouchedFilePayload = z.infer<typeof touchedFileSchema>;
export type RecipeSlicePayload = z.infer<typeof sliceSchema>;
export type RecipeCandidatePayload = z.infer<typeof candidateSchema>;
export type ProbeAssignment = z.infer<typeof probeAssignmentSchema>;
export type RecipeCandidatesList = z.infer<typeof recipeCandidatesListSchema>;
