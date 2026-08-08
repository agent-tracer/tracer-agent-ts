import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { DataSource, type EntityTarget, type Repository, type ObjectLiteral } from "typeorm";

type LedgerEntity = new (...args: never[]) => ObjectLiteral;

const POSTGRES_IMAGE = "postgres:16-alpine";
// 컨테이너를 띄우고 스키마를 세우는 데 걸리는 시간이며 케이스 하나의 상한이 아니다.
export const LEDGER_CONTAINER_STARTUP_MS = 120_000;

export interface StartedLedger {
    readonly source: DataSource;
    repository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T>;
    truncate(): Promise<void>;
    stop(): Promise<void>;
}

/** 연결을 유한한 자원으로 세워 한 요청이 연결을 몇 개 요구하는지 드러나게 하는 설정이다. */
export interface LedgerPoolOptions {
    readonly size: number;
    readonly acquireTimeoutMs: number;
}

/** 판정이 Postgres 방언에 매여 있으므로 계약의 migration 을 그대로 적용한 실제 원장을 띄우며, pool 을 주지 않으면 연결 상한이 없어 한 요청이 연결을 몇 개 요구하는지 드러나지 않는다. */
export async function startLedger(
    migrationsDir: string,
    entities: readonly LedgerEntity[],
    pool?: LedgerPoolOptions,
): Promise<StartedLedger> {
    const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const source = new DataSource({
        type: "postgres",
        url: container.getConnectionUri(),
        entities: [...entities],
        synchronize: false,
        ...(pool === undefined
            ? {}
            : { poolSize: pool.size, extra: { connectionTimeoutMillis: pool.acquireTimeoutMs } }),
    });
    await source.initialize();
    for (const statement of readMigrations(migrationsDir)) await source.query(statement);
    return {
        source,
        repository: (entity) => source.getRepository(entity),
        truncate: () => truncateAll(source),
        stop: async () => {
            await source.destroy();
            await container.stop();
        },
    };
}

/** 케이스마다 원장을 비워 앞 케이스가 기록한 행이 다음 판정에 섞이지 않게 한다. */
async function truncateAll(source: DataSource): Promise<void> {
    const tables = source.entityMetadatas.map((meta) => `"${meta.tableName}"`).join(", ");
    if (tables.length > 0) await source.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

function readMigrations(dir: string): string[] {
    return readdirSync(dir)
        .filter((name) => name.endsWith(".sql"))
        .sort()
        .map((name) => readFileSync(path.join(dir, name), "utf8"));
}
