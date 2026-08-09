import { NativeConnection, Worker } from "@temporalio/worker";
import { installWorkerTelemetry } from "./worker.telemetry.js";
import { workflowBundlerOptions, workflowEntryPath } from "./workflow.bundle.js";

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
    const worker = await Worker.create({
        connection,
        namespace: options.namespace,
        taskQueue: options.taskQueue,
        workflowsPath: workflowEntryPath("chat.workflows"),
        activities: options.activities,
        bundlerOptions: workflowBundlerOptions,
        shutdownGraceTime: "5 minutes",
        shutdownForceTime: "6 minutes",
    });
    return {
        run: () => worker.run(),
        shutdown: () => void worker.shutdown(),
        close: () => connection.close(),
    };
}
