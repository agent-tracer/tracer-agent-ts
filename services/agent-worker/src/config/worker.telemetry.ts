import { Runtime } from "@temporalio/worker";
import { TEMPORAL_SDK_METRICS_PORT } from "./queue.const.js";

/** Worker.create 보다 먼저 불러야 수집되는 워커 SDK 지표 창구를 프로세스마다 한 번 연다. */
export function installWorkerTelemetry(): void {
    Runtime.install({
        telemetryOptions: {
            metrics: {
                prometheus: {
                    bindAddress: `0.0.0.0:${TEMPORAL_SDK_METRICS_PORT}`,
                    // 기본값이 밀리초라 명시하지 않으면 경보 임계값과 패널 단위가 갈린다.
                    useSecondsForDurations: true,
                },
            },
        },
    });
}
