import { z } from "zod";
import { RECIPE_OUTCOMES, RECIPE_STATUSES } from "~agent-api/domain/recipe/model/recipe.const.js";
import { RECIPE_SEARCH_LIMIT } from "~agent-api/domain/recipe/application/query/search.recipes.usecase.js";

export const listQuerySchema = z.object({ status: z.enum(RECIPE_STATUSES).optional() });

export const searchQuerySchema = z.object({
    q: z.string().trim().min(1),
    limit: z.coerce.number().int().min(RECIPE_SEARCH_LIMIT.min).max(RECIPE_SEARCH_LIMIT.max).optional(),
});

export const editBodySchema = z
    .object({
        title: z.string().trim().min(1).max(120).optional(),
        intent: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().min(1).max(400).optional(),
        summaryMd: z.string().trim().min(1).max(4000).optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export const outcomeBodySchema = z
    .object({
        taskId: z.string().trim().min(1),
        outcome: z.enum(RECIPE_OUTCOMES),
        note: z.string().trim().min(1).max(2000).optional(),
    })
    .strict();

export type ListQuery = z.infer<typeof listQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type EditBody = z.infer<typeof editBodySchema>;
export type OutcomeBody = z.infer<typeof outcomeBodySchema>;
