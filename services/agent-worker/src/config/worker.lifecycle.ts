import { errorMessage, logError, logInfo } from "@tracer-agent/platform";

interface WorkerSet {
    run(): Promise<unknown>;
    close(): Promise<unknown>;
    shutdown(): void;
}

interface Producer {
    disconnect(): Promise<unknown>;
}

interface Ledger {
    destroy(): Promise<unknown>;
}

// 강제 종료까지의 유예이며 이 안에 정리가 끝나지 않으면 프로세스를 내린다.
const FORCE_EXIT_MS = 10_000;

export async function runUntilShutdown(input: {
    workers: WorkerSet;
    producer: Producer;
    dataSource: Ledger;
}): Promise<void> {
    const shutdown = (signal: NodeJS.Signals): void => {
        logInfo({ msg: "process.lifecycle.stopping", signal });
        input.workers.shutdown();
    };
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
    try {
        await input.workers.run();
    } finally {
        const forceExit = setTimeout(() => {
            logError({ msg: "process.shutdown.timed_out" });
            process.exit(1);
        }, FORCE_EXIT_MS);
        forceExit.unref();
        await input.producer.disconnect().catch((error: unknown) =>
            logError({ msg: "process.producer_shutdown.failed", error: errorMessage(error) }),
        );
        await input.workers.close().catch((error: unknown) =>
            logError({ msg: "process.worker_shutdown.failed", error: errorMessage(error) }),
        );
        await input.dataSource.destroy().catch((error: unknown) =>
            logError({ msg: "process.datasource_shutdown.failed", error: errorMessage(error) }),
        );
        clearTimeout(forceExit);
    }
}
