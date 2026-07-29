import type { IClock } from "@tracer-agent/platform";
import { JOB_KIND, JOB_STATUS } from "~agent-worker/support/job.const.js";
import type { FailTitleJobInput } from "~agent-worker/domain/title/model/title.job.model.js";
import type { TitleNotificationPort } from "~agent-worker/domain/title/port/title.notification.port.js";
import type { TitleRepositoryPort } from "~agent-worker/domain/title/port/title.repository.port.js";

const ERROR_LIMIT = 1000;
const SUMMARY_LIMIT = 240;

/** 워크플로가 재시도를 모두 소진한 뒤에만 불러 잡을 실패로 종결한다. */
export class FailTitleJobUsecase {
    constructor(
        private readonly repository: TitleRepositoryPort,
        private readonly notification: TitleNotificationPort,
        private readonly clock: IClock,
    ) {}

    async execute(input: FailTitleJobInput): Promise<void> {
        const failed = await this.repository.failJob(
            input.jobId,
            truncate(input.message, ERROR_LIMIT),
            this.clock.now(),
        );
        if (failed === null) return;

        await this.notification.jobUpdated(failed.userId, {
            jobId: failed.id,
            kind: JOB_KIND.titleSuggestion,
            status: JOB_STATUS.failed,
            error: truncate(input.message, SUMMARY_LIMIT),
        });
    }
}

function truncate(value: string, limit: number): string {
    return value.length <= limit ? value : `${value.slice(0, limit)}...`;
}
