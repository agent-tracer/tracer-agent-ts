import { afterEach, describe, expect, it } from "vitest";
import { assertTraceEnvironment, isTracingEnabled } from "./trace.environment.js";

const KEYS = [
    "LANGSMITH_TRACING",
    "LANGSMITH_ENDPOINT",
    "LANGSMITH_PROJECT",
    "LANGSMITH_API_KEY",
] as const;

function withTracing(overrides: Readonly<Record<string, string>>): void {
    for (const key of KEYS) delete process.env[key];
    process.env.LANGSMITH_TRACING = "true";
    for (const [key, value] of Object.entries(overrides)) process.env[key] = value;
}

afterEach(() => {
    for (const key of KEYS) delete process.env[key];
});

describe("추적 기동 검증", () => {
    it("추적이 꺼져 있으면 아무 값도 요구하지 않는다", () => {
        process.env.LANGSMITH_TRACING = "false";

        expect(isTracingEnabled()).toBe(false);
        expect(() => assertTraceEnvironment()).not.toThrow();
    });

    it("추적을 켜고 창구를 부를 값이 비면 기동을 중단한다", () => {
        withTracing({ LANGSMITH_ENDPOINT: "https://trace.example", LANGSMITH_PROJECT: "agent" });

        expect(() => assertTraceEnvironment()).toThrow("LANGSMITH_API_KEY");
    });

    it("추적을 켜고 창구를 부를 값이 다 있으면 기동을 이어 간다", () => {
        withTracing({
            LANGSMITH_ENDPOINT: "https://trace.example",
            LANGSMITH_PROJECT: "agent",
            LANGSMITH_API_KEY: "lsv2-key",
        });

        expect(isTracingEnabled()).toBe(true);
        expect(() => assertTraceEnvironment()).not.toThrow();
    });
});
