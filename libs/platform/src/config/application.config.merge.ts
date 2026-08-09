import { applicationConfigSchema, type ApplicationConfig } from "./application.config.schema.js";

function isSection(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function section(source: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = source[key];
    return isSection(value) ? value : {};
}

/** 로컬 YAML은 섹션을 통째로 대체하지 않고 섹션 안의 칸만 덮으므로, 한 칸만 적은 로컬 YAML이 같은 섹션의 나머지 칸을 지우고 기본값을 불러들이지 않는다. */
function mergeSections(
    base: Record<string, unknown>,
    local: Record<string, unknown>,
): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...base, ...local };
    for (const key of Object.keys(local)) {
        if (!isSection(base[key]) || !isSection(local[key])) continue;
        merged[key] = { ...section(base, key), ...section(local, key) };
    }
    return merged;
}

function envInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
    const raw = env[key];
    return raw ? Number(raw) : fallback;
}

/** 기본 YAML의 섹션 위에 로컬 YAML의 칸과 환경변수를 차례로 적용하고 전체 설정을 검증한다. */
export function mergeApplicationConfig(
    base: Record<string, unknown>,
    local: Record<string, unknown>,
    env: NodeJS.ProcessEnv,
): ApplicationConfig {
    const merged = mergeSections(base, local);
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
            // 원장 연결 상한의 기본값을 드라이버가 아니라 애플리케이션 설정이 소유하게 한다.
            poolSize: envInt(env, "AGENT_DB_POOL_SIZE", (agentDb["poolSize"] as number | undefined) ?? 10),
            connectionTimeoutMs: envInt(
                env,
                "AGENT_DB_CONNECTION_TIMEOUT_MS",
                (agentDb["connectionTimeoutMs"] as number | undefined) ?? 5000,
            ),
        },
        kafka: { brokers },
        temporal: {
            address: env["TEMPORAL_ADDRESS"] ?? (temporal["address"] as string | undefined) ?? "localhost:7233",
            namespace: env["TEMPORAL_NAMESPACE"] ?? (temporal["namespace"] as string | undefined) ?? "default",
        },
    });
}
