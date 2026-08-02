import { z } from "zod";
import { probeReportSchema } from "./recipe.dispatch.schema.js";

/** 전문가 하나가 낸 결과이며 원장에 적었다가 다시 시도한 실행이 그대로 되살린다. */
export const probeStageSchema = z.object({
  report: probeReportSchema,
  ledger: z.object({
    eventIdsByTask: z.record(z.string(), z.array(z.string())),
    turnIdsByTask: z.record(z.string(), z.array(z.string())),
    ruleIds: z.array(z.string()),
    recipeRevs: z.record(z.string(), z.number()),
  }),
  accounting: z.object({
    durationMs: z.number(),
    costUsd: z.number().nullable(),
    numTurns: z.number().nullable(),
    usage: z
      .object({
        inputTokens: z.number(),
        outputTokens: z.number(),
        cacheReadTokens: z.number(),
        cacheCreationTokens: z.number(),
      })
      .nullable(),
  }),
});

export type ProbeStageOutput = z.infer<typeof probeStageSchema>;

