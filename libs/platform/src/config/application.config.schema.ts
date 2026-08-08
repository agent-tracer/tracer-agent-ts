import { z } from "zod";

const dbSchema = z.object({
    host: z.string().min(1),
    port: z.number().int().positive().max(65535),
    username: z.string().min(1),
    password: z.string(),
    database: z.string().min(1),
    /** 한 프로세스가 동시에 쥘 수 있는 연결 수이며 넘으면 뒤의 질의가 줄을 선다. */
    poolSize: z.number().int().positive().max(1000),
    /** 줄을 선 질의가 연결을 못 받고 기다리는 상한이며 이 값이 없으면 고갈이 영구 정지가 된다. */
    connectionTimeoutMs: z.number().int().positive().max(600000),
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
