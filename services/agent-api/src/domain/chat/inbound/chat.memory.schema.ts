import { z } from "zod";

export const rememberFactBodySchema = z.object({
    content: z.string().trim().min(1).max(4000),
});

export type RememberFactBody = z.infer<typeof rememberFactBodySchema>;
