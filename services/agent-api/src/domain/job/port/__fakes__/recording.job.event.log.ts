import type {
    JobEnqueuedLog,
    JobEventLog,
    JobIdempotencyConflictLog,
    JobLlmKeyMissingLog,
} from "~agent-api/domain/job/port/job.event.log.port.js";

/** 접수 로그 포트의 대역이며 무엇을 적었는지만 모아 둔다. */
export class RecordingJobEventLog implements JobEventLog {
    readonly enqueuedEntries: JobEnqueuedLog[] = [];
    readonly conflicts: JobIdempotencyConflictLog[] = [];
    readonly keyMissing: JobLlmKeyMissingLog[] = [];

    enqueued(entry: JobEnqueuedLog): void {
        this.enqueuedEntries.push(entry);
    }

    idempotencyConflict(entry: JobIdempotencyConflictLog): void {
        this.conflicts.push(entry);
    }

    llmKeyMissing(entry: JobLlmKeyMissingLog): void {
        this.keyMissing.push(entry);
    }
}
