import { isCancellation, proxyActivities } from "@temporalio/workflow";
import type { FailCleanupJobInput } from "~agent-worker/domain/cleanup/application/fail.cleanup.job.usecase.js";
import type { TaskCleanupFinalizeInput } from "~agent-worker/domain/cleanup/application/finalize.task.cleanup.usecase.js";
import type {
    TaskCleanupInput,
    TaskCleanupPrep,
} from "~agent-worker/domain/cleanup/application/prepare.task.cleanup.usecase.js";
import type { TaskCleanupGenerateOutput } from "~agent-worker/domain/cleanup/application/suggest.cleanup.usecase.js";
import { messageOf } from "~agent-worker/support/failure.message.js";

/** 긴 모델 호출이 짧은 활동의 슬롯을 막지 않도록 분리한 큐다. */
const GENERATE_TASK_QUEUE = "sdk-generate";

interface CleanupPrepareActivities {
    prepareTaskCleanup(input: TaskCleanupInput): Promise<TaskCleanupPrep>;
}

interface CleanupGenerateActivities {
    generateTaskCleanupSuggestions(prep: TaskCleanupPrep): Promise<TaskCleanupGenerateOutput>;
}

interface CleanupFinalizeActivities {
    finalizeTaskCleanup(input: TaskCleanupFinalizeInput): Promise<void>;
    markCleanupJobFailed(input: FailCleanupJobInput): Promise<void>;
}

const { prepareTaskCleanup } = proxyActivities<CleanupPrepareActivities>({
    startToCloseTimeout: "2 minutes",
    retry: { maximumAttempts: 5 },
});

const { generateTaskCleanupSuggestions } = proxyActivities<CleanupGenerateActivities>({
    taskQueue: GENERATE_TASK_QUEUE,
    startToCloseTimeout: "10 minutes",
    scheduleToCloseTimeout: "30 minutes",
    heartbeatTimeout: "30 seconds",
    retry: { maximumAttempts: 3, initialInterval: "10 seconds" },
});

const { finalizeTaskCleanup, markCleanupJobFailed } = proxyActivities<CleanupFinalizeActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

/** 태스크 정리 제안 잡을 실행한다. */
export async function taskCleanupWorkflow(input: TaskCleanupInput): Promise<void> {
    try {
        const prep = await prepareTaskCleanup(input);
        const output = prep.candidates.length === 0 ? null : await generateTaskCleanupSuggestions(prep);
        await finalizeTaskCleanup({
            jobId: prep.jobId,
            userId: prep.userId,
            tasksScanned: prep.tasksScanned,
            output,
        });
    } catch (err) {
        if (isCancellation(err)) throw err;
        await markCleanupJobFailed({ jobId: input.jobId, message: messageOf(err) });
        throw err;
    }
}
