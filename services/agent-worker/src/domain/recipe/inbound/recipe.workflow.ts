import { isCancellation, proxyActivities, workflowInfo } from "@temporalio/workflow";
import type { FailRecipeJobInput } from "~agent-worker/domain/recipe/application/fail.recipe.job.usecase.js";
import type { RecipeScanFinalizeInput } from "~agent-worker/domain/recipe/application/finalize.recipe.scan.usecase.js";
import type {
    RecipeScanInput,
    RecipeScanPrep,
} from "~agent-worker/domain/recipe/application/prepare.recipe.scan.usecase.js";
import type { RecipeScanGenerateOutput } from "~agent-worker/domain/recipe/application/scan.recipe.usecase.js";
import { messageOf } from "~agent-worker/support/failure.message.js";
import { generateTaskQueueOf } from "~agent-worker/support/task.queue.js";

interface RecipePrepareActivities {
    prepareRecipeScan(input: RecipeScanInput): Promise<RecipeScanPrep>;
}

interface RecipeGenerateActivities {
    generateRecipeCandidates(prep: RecipeScanPrep): Promise<RecipeScanGenerateOutput>;
}

interface RecipeFinalizeActivities {
    finalizeRecipeScan(input: RecipeScanFinalizeInput): Promise<void>;
    markRecipeJobFailed(input: FailRecipeJobInput): Promise<void>;
}

const { prepareRecipeScan } = proxyActivities<RecipePrepareActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

const { finalizeRecipeScan, markRecipeJobFailed } = proxyActivities<RecipeFinalizeActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

/** 긴 모델 호출이 짧은 활동의 슬롯을 막지 않도록 분리한 생성 큐로 보낸다. */
function generateActivities() {
    return proxyActivities<RecipeGenerateActivities>({
        taskQueue: generateTaskQueueOf(workflowInfo().taskQueue),
        startToCloseTimeout: "15 minutes",
        scheduleToCloseTimeout: "1 hour",
        heartbeatTimeout: "30 seconds",
        retry: { maximumAttempts: 3, initialInterval: "10 seconds" },
    });
}

/** 레시피 후보 생성 잡을 실행한다. */
export async function recipeScanWorkflow(input: RecipeScanInput): Promise<void> {
    const { generateRecipeCandidates } = generateActivities();
    try {
        const prep = await prepareRecipeScan(input);
        const output = await generateRecipeCandidates(prep);
        await finalizeRecipeScan({
            jobId: prep.jobId,
            userId: prep.userId,
            sourceTaskId: prep.taskId,
            language: prep.language,
            output,
        });
    } catch (err) {
        if (isCancellation(err)) throw err;
        await markRecipeJobFailed({ jobId: input.jobId, message: messageOf(err) });
        throw err;
    }
}
