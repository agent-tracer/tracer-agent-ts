import { z } from "zod";

const dbSchema = z.object({
    host: z.string().min(1),
    port: z.number().int().positive().max(65535),
    username: z.string().min(1),
    password: z.string(),
    database: z.string().min(1),
});

export const applicationConfigSchema = z.object({
    profile: z.enum(["local", "prd"]),
    agentApi: z.object({ port: z.number().int().positive().max(65535) }),
    listenHost: z.string().min(1),
    agentDb: dbSchema,
    kafka: z.object({ brokers: z.array(z.string().min(1)).min(1) }),
    temporal: z.object({ address: z.string().min(1), namespace: z.string().min(1) }),
});

export type ApplicationConfig = z.infer<typeof applicationConfigSchema>;
export type DbConfig = z.infer<typeof dbSchema>;
