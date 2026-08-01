import { Runtime } from "@temporalio/worker";
import { AGENT_BACKEND } from "@tracer-agent/llm";
import { readAxisLabel, readWorkerSdkMetrics } from "../support/contract.js";

/** Worker.create 보다 먼저 불러야 수집되는 워커 SDK 지표 창구를 프로세스마다 한 번 연다. */
export function installWorkerTelemetry(): void {
    const declared = readWorkerSdkMetrics();
    Runtime.install({
        telemetryOptions: {
            metrics: {
                // 이 창구는 수집기를 지나지 않고 Prometheus 가 그대로 긁으므로 라벨 이름을 싣는다.
                globalTags: { [readAxisLabel().labelName]: AGENT_BACKEND },
                prometheus: {
                    bindAddress: `${declared.bindAddress}:${declared.port}`,
                    useSecondsForDurations: declared.durationUnit === "seconds",
                    countersTotalSuffix: declared.countersTotalSuffix,
                    unitSuffix: declared.unitSuffix,
                },
            },
        },
    });
}
