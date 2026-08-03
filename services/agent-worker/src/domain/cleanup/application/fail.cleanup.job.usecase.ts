import type { IClock } from "@tracer-agent/platform";
import { JOB_KIND, JOB_STATUS } from "~agent-worker/support/job.const.js";
import type { JobNotificationPort } from "~agent-worker/support/job.notification.port.js";
import type { CleanupRepositoryPort } from "../port/cleanup.repository.port.js";

const ERROR_LIMIT = 1000;
const SUMMARY_LIMIT = 240;

export interface FailCleanupJobInput {
    readonly jobId: string;
    readonly message: string;
}

/** 워크플로가 재시도를 모두 소진한 뒤에만 불러 잡을 실패로 종결한다. */
export class FailCleanupJobUsecase {
    constructor(
        private readonly repository: CleanupRepositoryPort,
        private readonly notification: JobNotificationPort,
        private readonly clock: IClock,
    ) {}

    async execute(input: FailCleanupJobInput): Promise<void> {
        const failed = await this.repository.failJob(
            input.jobId,
            truncate(input.message, ERROR_LIMIT),
            this.clock.now(),
        );
        if (failed === null) return;

        await this.notification.jobUpdated(failed.userId, {
            jobId: failed.id,
            kind: JOB_KIND.taskCleanup,
            status: JOB_STATUS.failed,
            error: truncate(input.message, SUMMARY_LIMIT),
        });
    }
}

function truncate(value: string, limit: number): string {
    return value.length <= limit ? value : `${value.slice(0, limit)}...`;
}
