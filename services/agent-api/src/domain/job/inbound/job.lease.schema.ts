import { z } from "zod";

export const reportBodySchema = z.object({
    rules: z.array(z.record(z.string(), z.unknown())),
    skipped: z.array(z.string()).optional(),
});

export const failureBodySchema = z.object({
    message: z.string().trim().min(1),
    retryable: z.boolean().optional(),
});

export type ReportBody = z.infer<typeof reportBodySchema>;
export type FailureBody = z.infer<typeof failureBodySchema>;
