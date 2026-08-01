import { describe, expect, it, vi } from "vitest";
import { AGENT_AXIS } from "@tracer-agent/llm";
import { readAxisLabel, readWorkerSdkMetrics } from "~agent-worker/support/contract.js";
import { TEMPORAL_SDK_METRICS_PORT } from "./queue.const.js";
import { installWorkerTelemetry } from "./worker.telemetry.js";

interface PrometheusOptions {
    readonly bindAddress: string;
    readonly useSecondsForDurations: boolean;
    readonly countersTotalSuffix: boolean;
    readonly unitSuffix: boolean;
}

interface MetricsOptions {
    readonly globalTags: Record<string, string>;
    readonly prometheus: PrometheusOptions;
}

interface RuntimeOptions {
    readonly telemetryOptions: { readonly metrics: MetricsOptions };
}

const { install } = vi.hoisted(() => ({ install: vi.fn<(options: RuntimeOptions) => void>() }));

vi.mock("@temporalio/worker", () => ({ Runtime: { install } }));

const DECLARED = readWorkerSdkMetrics();

function installedMetrics(): MetricsOptions | undefined {
    install.mockClear();
    installWorkerTelemetry();
    return install.mock.calls[0]?.[0].telemetryOptions.metrics;
}

describe("워커 SDK 지표 창구", () => {
    it("계약이 정한 자리에 창구를 연다", () => {
        expect(TEMPORAL_SDK_METRICS_PORT).toBe(DECLARED.port);
        expect(installedMetrics()?.prometheus.bindAddress).toBe(`${DECLARED.bindAddress}:${DECLARED.port}`);
    });

    it("계약이 정한 시간 단위로 지속 시간을 낸다", () => {
        expect(installedMetrics()?.prometheus.useSecondsForDurations).toBe(
            DECLARED.durationUnit === "seconds",
        );
    });

    it("이름을 빚는 값을 계약에서 받아 넘긴다", () => {
        const prometheus = installedMetrics()?.prometheus;

        expect(prometheus?.countersTotalSuffix).toBe(DECLARED.countersTotalSuffix);
        expect(prometheus?.unitSuffix).toBe(DECLARED.unitSuffix);
    });

    it("모든 지표에 축의 라벨을 싣는다", () => {
        const tags = installedMetrics()?.globalTags ?? {};

        expect(Object.values(tags)).toContain(AGENT_AXIS.ts);
        expect(Object.keys(tags)).toEqual([readAxisLabel().labelName]);
    });

    it("창구가 싣는 이름을 Prometheus 가 그대로 읽는다", () => {
        expect(readAxisLabel().labelName).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
    });
});
