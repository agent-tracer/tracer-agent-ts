import { isCancellation, proxyActivities, workflowInfo } from "@temporalio/workflow";
import { messageOf } from "~agent-worker/support/failure.message.js";
import { generateTaskQueueOf } from "~agent-worker/support/task.queue.js";
import { JOB_GENERATE_LIMITS } from "~agent-worker/support/job.workflow.spec.js";
import type {
    FailTitleJobInput,
    TitleSuggestionFinalizeInput,
    TitleSuggestionGenerateOutput,
    TitleSuggestionInput,
    TitleSuggestionPrep,
} from "~agent-worker/domain/title/model/title.job.model.js";

interface TitlePrepareActivities {
    prepareTitleSuggestion(input: TitleSuggestionInput): Promise<TitleSuggestionPrep>;
}

interface TitleGenerateActivities {
    generateTitleSuggestion(prep: TitleSuggestionPrep): Promise<TitleSuggestionGenerateOutput>;
}

interface TitleFinalizeActivities {
    finalizeTitleSuggestion(input: TitleSuggestionFinalizeInput): Promise<void>;
    markTitleJobFailed(input: FailTitleJobInput): Promise<void>;
}

const { prepareTitleSuggestion } = proxyActivities<TitlePrepareActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

const { finalizeTitleSuggestion, markTitleJobFailed } = proxyActivities<TitleFinalizeActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

/** 긴 모델 호출이 짧은 활동의 슬롯을 막지 않도록 분리한 생성 큐로 보낸다. */
function generateActivities() {
    return proxyActivities<TitleGenerateActivities>({
        taskQueue: generateTaskQueueOf(workflowInfo().taskQueue),
        startToCloseTimeout: JOB_GENERATE_LIMITS.titleSuggestion.startToClose,
        scheduleToCloseTimeout: JOB_GENERATE_LIMITS.titleSuggestion.scheduleToClose,
        heartbeatTimeout: JOB_GENERATE_LIMITS.titleSuggestion.heartbeat,
        retry: {
            maximumAttempts: JOB_GENERATE_LIMITS.titleSuggestion.maximumAttempts,
            initialInterval: JOB_GENERATE_LIMITS.titleSuggestion.initialInterval,
        },
    });
}

/** 제목 제안 잡을 실행한다. */
export async function titleSuggestionWorkflow(input: TitleSuggestionInput): Promise<void> {
    const { generateTitleSuggestion } = generateActivities();
    try {
        const prep = await prepareTitleSuggestion(input);
        const output = await generateTitleSuggestion(prep);
        await finalizeTitleSuggestion({ jobId: prep.jobId, userId: prep.userId, output });
    } catch (err) {
        if (isCancellation(err)) throw err;
        await markTitleJobFailed({ jobId: input.jobId, message: messageOf(err) });
        throw err;
    }
}
