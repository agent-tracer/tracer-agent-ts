import { isCancellation, proxyActivities } from "@temporalio/workflow";
import { messageOf } from "~agent-worker/support/failure.message.js";
import type {
    FailTitleJobInput,
    TitleSuggestionFinalizeInput,
    TitleSuggestionGenerateOutput,
    TitleSuggestionInput,
    TitleSuggestionPrep,
} from "~agent-worker/domain/title/model/title.job.model.js";

/** 긴 모델 호출이 짧은 활동의 슬롯을 굶기지 않도록 분리한 큐이며 값은 계약이 소유한다. */
const GENERATE_TASK_QUEUE = "sdk-generate";

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

const { generateTitleSuggestion } = proxyActivities<TitleGenerateActivities>({
    taskQueue: GENERATE_TASK_QUEUE,
    startToCloseTimeout: "5 minutes",
    scheduleToCloseTimeout: "20 minutes",
    heartbeatTimeout: "30 seconds",
    retry: { maximumAttempts: 3, initialInterval: "10 seconds" },
});

const { finalizeTitleSuggestion, markTitleJobFailed } = proxyActivities<TitleFinalizeActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

/** 제목 제안 잡을 실행한다. */
export async function titleSuggestionWorkflow(input: TitleSuggestionInput): Promise<void> {
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
