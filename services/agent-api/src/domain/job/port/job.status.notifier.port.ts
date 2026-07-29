import type { JobKind, JobStatus } from "~agent-api/domain/job/model/job.const.js";

export const JOB_STATUS_NOTIFIER = Symbol("JobStatusNotifier");

export interface JobStatusChange {
    readonly jobId: string;
    readonly kind: JobKind;
    readonly status: JobStatus;
    readonly taskId?: string | undefined;
}

/** 잡 상태 전이를 사용자의 열린 화면에 알리는 유실 허용 신호다. */
export interface JobStatusNotifier {
    notify(userId: string, change: JobStatusChange): void;
}
