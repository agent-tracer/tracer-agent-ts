import { NativeConnection, Worker } from "@temporalio/worker";
import { logInfo } from "@tracer-agent/platform";
import { JOB_TASK_QUEUE } from "./queue.const.js";
import { installWorkerTelemetry } from "./worker.telemetry.js";

/** 활동 이름을 활동 구현에 잇는 등록표다. */
export type ActivityTable = Record<string, (...args: never[]) => Promise<unknown>>;

export interface TemporalWorkerOptions {
    readonly address: string;
    readonly namespace: string;
    /** 이 프로세스가 폴링할 큐 하나이며 값에 따라 워크플로 번들 포함 여부와 동시성 설정이 갈린다. */
    readonly taskQueue: string;
    readonly activities: ActivityTable;
    /** 생성 큐의 파드별 동시 활동 상한이며 replica 수를 곱한 값이 전체 동시 모델 호출 총량이다. */
    readonly generateMaxConcurrentActivities?: number;
}

export interface TemporalWorkerHandle {
    run(): Promise<void>;
    shutdown(): void;
    close(): Promise<void>;
}

/** 기동 인자로 받은 큐 하나만 폴링하는 워커를 만들며 한 프로세스가 두 큐를 겸하지 않는다. */
export async function createTemporalWorker(options: TemporalWorkerOptions): Promise<TemporalWorkerHandle> {
    installWorkerTelemetry();

    const connection = await NativeConnection.connect({ address: options.address });
    const isJobsQueue = options.taskQueue === JOB_TASK_QUEUE;

    // 워크플로 번들의 진입점은 슬라이스를 전부 아는 조립 근원이므로 config가 아니라 src 뿌리에 있다.
    const workflowsPath = new URL(
        `../workflows.${import.meta.url.endsWith(".ts") ? "ts" : "js"}`,
        import.meta.url,
    ).pathname;

    const worker = await Worker.create({
        connection,
        namespace: options.namespace,
        taskQueue: options.taskQueue,
        activities: options.activities,
        // 워크플로는 잡 큐에서만 돌고 생성 큐는 활동 전용이라 번들이 필요 없다.
        ...(isJobsQueue
            ? {
                workflowsPath,
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
            }
            : {
                // 최대 15분인 생성 활동이 짧은 활동의 슬롯을 굶기지 않도록 낮은 동시성으로 돈다.
                maxConcurrentActivityTaskExecutions: options.generateMaxConcurrentActivities ?? 6,
                // 배포가 진행 중인 언어 모델 호출을 즉시 중단해 유료 결과를 버리지 않도록 유예를 준다.
                shutdownGraceTime: "5 minutes",
                shutdownForceTime: "6 minutes",
            }),
    });

    logInfo({ msg: "temporal.worker.polling", address: options.address, queue: options.taskQueue });

    return {
        run: () => worker.run(),
        shutdown: () => void worker.shutdown(),
        close: () => connection.close(),
    };
}
