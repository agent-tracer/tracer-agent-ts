import { Context } from "@temporalio/activity";
import { guardActivity } from "@tracer-agent/llm";
import type { FailCleanupJobInput, FailCleanupJobUsecase } from "~agent-worker/domain/cleanup/application/fail.cleanup.job.usecase.js";
import type {
    FinalizeTaskCleanupUsecase,
    TaskCleanupFinalizeInput,
} from "~agent-worker/domain/cleanup/application/finalize.task.cleanup.usecase.js";
import type {
    PrepareTaskCleanupUsecase,
    TaskCleanupInput,
    TaskCleanupPrep,
} from "~agent-worker/domain/cleanup/application/prepare.task.cleanup.usecase.js";
import type {
    SuggestCleanupUsecase,
    TaskCleanupGenerateOutput,
} from "~agent-worker/domain/cleanup/application/suggest.cleanup.usecase.js";
import { isNonRetryableCleanupError } from "~agent-worker/domain/cleanup/model/cleanup.error.js";

const HEARTBEAT_MS = 10_000;

/** 오케스트레이션 엔진의 활동 표면을 태스크 정리 유스케이스에 잇는다. */
export class CleanupActivity {
    constructor(
        private readonly prepare: PrepareTaskCleanupUsecase,
        private readonly suggest: SuggestCleanupUsecase,
        private readonly finalize: FinalizeTaskCleanupUsecase,
        private readonly fail: FailCleanupJobUsecase,
    ) {}

    prepareTaskCleanup = (input: TaskCleanupInput): Promise<TaskCleanupPrep> =>
        this.guard("prepareTaskCleanup", input.jobId, () => this.prepare.execute(input));

    generateTaskCleanupSuggestions = async (prep: TaskCleanupPrep): Promise<TaskCleanupGenerateOutput> => {
        const ctx = Context.current();
        const heartbeat = setInterval(() => Context.current().heartbeat(), HEARTBEAT_MS);
        try {
            return await this.guard("generateTaskCleanupSuggestions", prep.jobId, () =>
                this.suggest.execute(prep, {
                    attempt: ctx.info.attempt,
                    idempotencyKey: `${ctx.info.workflowExecution?.workflowId ?? prep.jobId}-${ctx.info.activityId}`,
                    abortSignal: ctx.cancellationSignal,
                }),
            );
        } finally {
            clearInterval(heartbeat);
        }
    };

    finalizeTaskCleanup = (input: TaskCleanupFinalizeInput): Promise<void> =>
        this.guard("finalizeTaskCleanup", input.jobId, () => this.finalize.execute(input));

    markCleanupJobFailed = (input: FailCleanupJobInput): Promise<void> =>
        this.guard("markCleanupJobFailed", input.jobId, () => this.fail.execute(input));

    private guard<T>(activity: string, jobId: string, run: () => Promise<T>): Promise<T> {
        return guardActivity({ activity, jobId, isNonRetryable: isNonRetryableCleanupError }, run);
    }
}
