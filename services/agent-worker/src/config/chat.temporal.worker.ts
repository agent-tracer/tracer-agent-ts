import { NativeConnection, Worker } from "@temporalio/worker";
import { installWorkerTelemetry } from "./worker.telemetry.js";

export type ChatActivityTable = Record<string, (...args: never[]) => Promise<unknown>>;

export interface ChatTemporalWorkerHandle {
    run(): Promise<void>;
    shutdown(): void;
    close(): Promise<void>;
}

/** 대화 활동만 소비하는 워커를 만들며 폴링할 큐는 기동 인자로 받는다. */
export async function createChatTemporalWorker(options: {
    readonly address: string;
    readonly namespace: string;
    readonly taskQueue: string;
    readonly activities: ChatActivityTable;
}): Promise<ChatTemporalWorkerHandle> {
    installWorkerTelemetry();

    const connection = await NativeConnection.connect({ address: options.address });
    const workflowsPath = new URL(
        `../chat.workflows.${import.meta.url.endsWith(".ts") ? "ts" : "js"}`,
        import.meta.url,
    ).pathname;
    const worker = await Worker.create({
        connection,
        namespace: options.namespace,
        taskQueue: options.taskQueue,
        workflowsPath,
        activities: options.activities,
        bundlerOptions: {
            // 워크플로 번들러는 자체 리졸버를 써서 tsconfig 별칭을 모르므로 여기서 알려준다.
            webpackConfigHook: (config) => {
                config.resolve = {
                    ...config.resolve,
                    alias: {
                        ...config.resolve?.alias,
                        "~agent-worker": new URL("..", import.meta.url).pathname,
                    },
                };
                return config;
            },
        },
        shutdownGraceTime: "5 minutes",
        shutdownForceTime: "6 minutes",
    });
    return {
        run: () => worker.run(),
        shutdown: () => void worker.shutdown(),
        close: () => connection.close(),
    };
}
