import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbConfig } from "../config/application.config.schema.js";
import { createDataSource } from "./datasource.factory.js";

// 컨테이너를 띄우는 데 걸리는 시간이며 케이스 하나의 상한이 아니다.
const CONTAINER_STARTUP_MS = 120_000;
const ACQUIRE_TIMEOUT_MS = 700;

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
}, CONTAINER_STARTUP_MS);

afterAll(async () => {
    await container.stop();
});

function configOf(poolSize: number): DbConfig {
    return {
        host: container.getHost(),
        port: container.getPort(),
        username: container.getUsername(),
        password: container.getPassword(),
        database: container.getDatabase(),
        poolSize,
        connectionTimeoutMs: ACQUIRE_TIMEOUT_MS,
    };
}

async function withSource(poolSize: number, work: (source: DataSource) => Promise<void>): Promise<void> {
    const source = createDataSource({ db: configOf(poolSize), entities: [] });
    await source.initialize();
    try {
        await work(source);
    } finally {
        await source.destroy();
    }
}

describe("설정이 정한 풀 상한", () => {
    it("상한만큼만 연결을 내주고 그 다음 질의는 줄을 세운다", async () => {
        await withSource(1, async (source) => {
            const held = source.createQueryRunner();
            await held.connect();

            const queued = source.query("SELECT 1");
            await expect(queued).rejects.toThrow();

            await held.release();
        });
    });

    it("상한 안이면 동시에 두 연결을 내준다", async () => {
        await withSource(2, async (source) => {
            const first = source.createQueryRunner();
            const second = source.createQueryRunner();
            await first.connect();
            await second.connect();

            expect(await first.query("SELECT 1 AS n")).toEqual([{ n: 1 }]);
            expect(await second.query("SELECT 1 AS n")).toEqual([{ n: 1 }]);

            await first.release();
            await second.release();
        });
    });
});

describe("설정이 정한 획득 여유", () => {
    it("연결을 못 받은 질의를 영구히 기다리게 두지 않고 실패로 낸다", async () => {
        await withSource(1, async (source) => {
            const held = source.createQueryRunner();
            await held.connect();

            const started = process.hrtime.bigint();
            await expect(source.query("SELECT 1")).rejects.toThrow(/timeout/i);
            const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;

            expect(elapsedMs).toBeLessThan(ACQUIRE_TIMEOUT_MS * 4);

            await held.release();
        });
    });

    it("쥔 연결을 반납하면 다음 질의가 다시 통과한다", async () => {
        await withSource(1, async (source) => {
            const held = source.createQueryRunner();
            await held.connect();
            await expect(source.query("SELECT 1")).rejects.toThrow();

            await held.release();

            expect(await source.query("SELECT 1 AS n")).toEqual([{ n: 1 }]);
        });
    });
});
