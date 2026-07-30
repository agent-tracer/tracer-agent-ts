import { applicationConfigSchema, type ApplicationConfig } from "./application.config.schema.js";

function section(source: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = source[key];
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function envInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
    const raw = env[key];
    return raw ? Number(raw) : fallback;
}

/** 기본 YAML 위에 로컬 YAML과 환경변수를 적용하고 전체 설정을 검증한다. */
export function mergeApplicationConfig(
    base: Record<string, unknown>,
    local: Record<string, unknown>,
    env: NodeJS.ProcessEnv,
): ApplicationConfig {
    const merged = { ...base, ...local };
    const agentDb = section(merged, "agentDb");
    const kafka = section(merged, "kafka");
    const temporal = section(merged, "temporal");
    const agentApi = section(merged, "agentApi");
    const user = env["POSTGRES_USER"] ?? "monitor";
    const password = env["POSTGRES_PASSWORD"] ?? "monitor";
    const brokersEnv = env["KAFKA_BROKERS"];
    const brokers = brokersEnv
        ? brokersEnv.split(",").map((broker) => broker.trim()).filter(Boolean)
        : ((kafka["brokers"] as string[] | undefined) ?? ["localhost:19092"]);
    return applicationConfigSchema.parse({
        profile: (env["MONITOR_PROFILE"] as "local" | "prd" | undefined)
            ?? (merged["profile"] as "local" | "prd" | undefined)
            ?? "local",
        agentApi: { port: envInt(env, "AGENT_API_PORT", (agentApi["port"] as number | undefined) ?? 3904) },
        listenHost: env["MONITOR_LISTEN_HOST"] ?? (merged["listenHost"] as string | undefined) ?? "127.0.0.1",
        agentDb: {
            host: env["AGENT_DB_HOST"] ?? (agentDb["host"] as string | undefined) ?? "127.0.0.1",
            port: envInt(env, "AGENT_DB_PORT", (agentDb["port"] as number | undefined) ?? 5434),
            username: env["AGENT_DB_USER"] ?? user,
            password: env["AGENT_DB_PASSWORD"] ?? password,
            database: env["AGENT_DB_NAME"] ?? (agentDb["database"] as string | undefined) ?? "agent",
        },
        kafka: { brokers },
        temporal: {
            address: env["TEMPORAL_ADDRESS"] ?? (temporal["address"] as string | undefined) ?? "localhost:7233",
            namespace: env["TEMPORAL_NAMESPACE"] ?? (temporal["namespace"] as string | undefined) ?? "default",
        },
    });
}
