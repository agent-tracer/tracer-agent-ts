import { describe, expect, it } from "vitest";
import { mergeApplicationConfig } from "./application.config.merge.js";

const BASE = {
    profile: "prd",
    listenHost: "0.0.0.0",
    agentApi: { port: 3904 },
    agentDb: { host: "127.0.0.1", port: 5555, database: "ledger" },
    kafka: { brokers: ["base:19092"] },
    temporal: { address: "temporal:7233", namespace: "agent" },
};

describe("설정 병합", () => {
    it("로컬 YAML 이 섹션의 한 칸만 적어도 기본 YAML 의 나머지 칸을 남긴다", () => {
        const config = mergeApplicationConfig(BASE, { agentDb: { host: "10.0.0.5" } }, {});

        expect(config.agentDb).toMatchObject({ host: "10.0.0.5", port: 5555, database: "ledger" });
    });

    it("로컬 YAML 이 적은 칸은 기본 YAML 을 덮는다", () => {
        const config = mergeApplicationConfig(
            BASE,
            { agentDb: { host: "10.0.0.5", port: 6000, database: "local" } },
            {},
        );

        expect(config.agentDb).toMatchObject({ host: "10.0.0.5", port: 6000, database: "local" });
    });

    it("로컬 YAML 이 말하지 않은 섹션은 기본 YAML 그대로 쓴다", () => {
        const config = mergeApplicationConfig(BASE, { agentDb: { host: "10.0.0.5" } }, {});

        expect(config.temporal).toEqual({ address: "temporal:7233", namespace: "agent" });
        expect(config.agentApi.port).toBe(3904);
    });

    it("섹션이 아닌 칸은 로컬 YAML 이 통째로 대체한다", () => {
        const config = mergeApplicationConfig(BASE, { profile: "local", listenHost: "127.0.0.1" }, {});

        expect(config.profile).toBe("local");
        expect(config.listenHost).toBe("127.0.0.1");
    });

    it("섹션 안의 목록은 로컬 YAML 이 통째로 대체한다", () => {
        const config = mergeApplicationConfig(BASE, { kafka: { brokers: ["local:19092"] } }, {});

        expect(config.kafka.brokers).toEqual(["local:19092"]);
    });

    it("환경변수는 두 YAML 을 모두 덮는다", () => {
        const config = mergeApplicationConfig(
            BASE,
            { agentDb: { host: "10.0.0.5" } },
            { AGENT_DB_HOST: "db.internal", AGENT_DB_PORT: "7000" },
        );

        expect(config.agentDb).toMatchObject({ host: "db.internal", port: 7000, database: "ledger" });
    });
});
