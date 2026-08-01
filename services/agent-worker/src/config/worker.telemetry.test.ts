import { describe, expect, it, vi } from "vitest";
import { readWorkerSdkMetrics } from "~agent-worker/support/contract.js";
import { TEMPORAL_SDK_METRICS_PORT } from "./queue.const.js";
import { installWorkerTelemetry } from "./worker.telemetry.js";

interface PrometheusOptions {
    readonly bindAddress: string;
    readonly useSecondsForDurations: boolean;
}

interface RuntimeOptions {
    readonly telemetryOptions: { readonly metrics: { readonly prometheus: PrometheusOptions } };
}

const { install } = vi.hoisted(() => ({ install: vi.fn<(options: RuntimeOptions) => void>() }));

vi.mock("@temporalio/worker", () => ({ Runtime: { install } }));

const DECLARED = readWorkerSdkMetrics();

function installedPrometheus(): PrometheusOptions | undefined {
    install.mockClear();
    installWorkerTelemetry();
    return install.mock.calls[0]?.[0].telemetryOptions.metrics.prometheus;
}

describe("워커 SDK 지표 창구", () => {
    it("계약이 정한 자리에 창구를 연다", () => {
        expect(TEMPORAL_SDK_METRICS_PORT).toBe(DECLARED.port);
        expect(installedPrometheus()?.bindAddress).toBe(`${DECLARED.bindAddress}:${DECLARED.port}`);
    });

    it("계약이 정한 시간 단위로 지속 시간을 낸다", () => {
        expect(installedPrometheus()?.useSecondsForDurations).toBe(DECLARED.durationUnit === "seconds");
    });
});
