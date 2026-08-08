import { isCancellation, proxyActivities, workflowInfo } from "@temporalio/workflow";
import type { FailCleanupJobInput } from "~agent-worker/domain/cleanup/application/fail.cleanup.job.usecase.js";
import type { TaskCleanupFinalizeInput } from "~agent-worker/domain/cleanup/application/finalize.task.cleanup.usecase.js";
import type {
    TaskCleanupInput,
    TaskCleanupPrep,
} from "~agent-worker/domain/cleanup/application/prepare.task.cleanup.usecase.js";
import type { TaskCleanupGenerateOutput } from "~agent-worker/domain/cleanup/application/suggest.cleanup.usecase.js";
import { messageOf } from "~agent-worker/support/failure.message.js";
import { generateTaskQueueOf } from "~agent-worker/support/task.queue.js";
import {
    JOB_GENERATE_LIMITS,
    JOB_SHORT_LIMITS,
    JOB_SHORT_MAX_ATTEMPTS,
} from "~agent-worker/support/job.workflow.spec.js";

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
    startToCloseTimeout: JOB_SHORT_LIMITS.taskCleanup.prepare,
    retry: { maximumAttempts: JOB_SHORT_MAX_ATTEMPTS },
});

const { finalizeTaskCleanup, markCleanupJobFailed } = proxyActivities<CleanupFinalizeActivities>({
    startToCloseTimeout: JOB_SHORT_LIMITS.taskCleanup.finalize,
    retry: { maximumAttempts: JOB_SHORT_MAX_ATTEMPTS },
});

/** 긴 모델 호출이 짧은 활동의 슬롯을 막지 않도록 분리한 생성 큐로 보낸다. */
function generateActivities() {
    return proxyActivities<CleanupGenerateActivities>({
        taskQueue: generateTaskQueueOf(workflowInfo().taskQueue),
        startToCloseTimeout: JOB_GENERATE_LIMITS.taskCleanup.startToClose,
        scheduleToCloseTimeout: JOB_GENERATE_LIMITS.taskCleanup.scheduleToClose,
        heartbeatTimeout: JOB_GENERATE_LIMITS.taskCleanup.heartbeat,
        retry: {
            maximumAttempts: JOB_GENERATE_LIMITS.taskCleanup.maximumAttempts,
            initialInterval: JOB_GENERATE_LIMITS.taskCleanup.initialInterval,
        },
    });
}

/** 태스크 정리 제안 잡을 실행한다. */
export async function taskCleanupWorkflow(input: TaskCleanupInput): Promise<void> {
    const { generateTaskCleanupSuggestions } = generateActivities();
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
