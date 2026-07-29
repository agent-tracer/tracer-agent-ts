import type { JobStatusChange, JobStatusNotifier } from "~agent-api/domain/job/port/job.status.notifier.port.js";

/** 상태 통지 포트의 대역이며 누구에게 무엇을 알렸는지만 적어 둔다. */
export class RecordingJobStatusNotifier implements JobStatusNotifier {
    readonly notified: { readonly userId: string; readonly change: JobStatusChange }[] = [];

    notify(userId: string, change: JobStatusChange): void {
        this.notified.push({ userId, change });
    }
}
