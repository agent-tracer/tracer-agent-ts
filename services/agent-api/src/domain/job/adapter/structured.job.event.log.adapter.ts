import { Injectable } from "@nestjs/common";
import { logInfo, logWarn } from "@tracer-agent/platform";
import type {
    JobEnqueuedLog,
    JobEventLog,
    JobIdempotencyConflictLog,
    JobLlmKeyMissingLog,
} from "~agent-api/domain/job/port/job.event.log.port.js";

/** 접수 결과를 구조화된 프로세스 로그로 출력한다. */
@Injectable()
export class StructuredJobEventLogAdapter implements JobEventLog {
    enqueued(entry: JobEnqueuedLog): void {
        logInfo({ msg: "job.queue.enqueued", ...entry });
    }

    idempotencyConflict(entry: JobIdempotencyConflictLog): void {
        logWarn({ msg: "job.idempotency.conflicted", ...entry });
    }

    llmKeyMissing(entry: JobLlmKeyMissingLog): void {
        logWarn({ msg: "job.llm_key.missing", ...entry });
    }
}
