export const JOB_EVENT_LOG = Symbol("JobEventLog");

/** 접수 경로의 관측 가능한 사건을 출력 기술과 분리해 기록한다. */
export interface JobEventLog {
    enqueued(entry: JobEnqueuedLog): void;
    idempotencyConflict(entry: JobIdempotencyConflictLog): void;
    llmKeyMissing(entry: JobLlmKeyMissingLog): void;
}

/** 새로 접수된 잡의 로그 표현이다. */
export interface JobEnqueuedLog {
    readonly userId: string;
    readonly jobId: string;
    readonly kind: string;
}

/** 같은 멱등키를 다른 입력으로 재사용해 거절된 요청의 로그 표현이다. */
export interface JobIdempotencyConflictLog {
    readonly userId: string;
    readonly kind: string;
}

/** 모델 자격이 없어 접수하지 못한 요청의 로그 표현이다. */
export interface JobLlmKeyMissingLog {
    readonly userId: string;
    readonly kind: string;
}
