import { Context } from "@temporalio/activity";
import { guardActivity } from "@tracer-agent/llm";
import type {
    FailRecipeJobInput,
    FailRecipeJobUsecase,
} from "~agent-worker/domain/recipe/application/fail.recipe.job.usecase.js";
import type {
    FinalizeRecipeScanUsecase,
    RecipeScanFinalizeInput,
} from "~agent-worker/domain/recipe/application/finalize.recipe.scan.usecase.js";
import type {
    PrepareRecipeScanUsecase,
    RecipeScanInput,
    RecipeScanPrep,
} from "~agent-worker/domain/recipe/application/prepare.recipe.scan.usecase.js";
import type {
    RecipeScanGenerateOutput,
    ScanRecipeUsecase,
} from "~agent-worker/domain/recipe/application/scan.recipe.usecase.js";
import { isNonRetryableRecipeError } from "~agent-worker/domain/recipe/model/recipe.error.js";

const HEARTBEAT_MS = 10_000;

/** 오케스트레이션 엔진의 활동 표면을 레시피 유스케이스에 잇는다. */
export class RecipeActivity {
    constructor(
        private readonly prepare: PrepareRecipeScanUsecase,
        private readonly scan: ScanRecipeUsecase,
        private readonly finalize: FinalizeRecipeScanUsecase,
        private readonly fail: FailRecipeJobUsecase,
    ) {}

    prepareRecipeScan = (input: RecipeScanInput): Promise<RecipeScanPrep> =>
        this.guard("prepareRecipeScan", input.jobId, () => this.prepare.execute(input));

    generateRecipeCandidates = async (prep: RecipeScanPrep): Promise<RecipeScanGenerateOutput> => {
        const ctx = Context.current();
        const heartbeat = setInterval(() => Context.current().heartbeat(), HEARTBEAT_MS);
        try {
            return await this.guard("generateRecipeCandidates", prep.jobId, () =>
                this.scan.execute(prep, {
                    attempt: ctx.info.attempt,
                    idempotencyKey: `${ctx.info.workflowExecution?.workflowId ?? prep.jobId}-${ctx.info.activityId}`,
                    abortSignal: ctx.cancellationSignal,
                }),
            );
        } finally {
            clearInterval(heartbeat);
        }
    };

    finalizeRecipeScan = (input: RecipeScanFinalizeInput): Promise<void> =>
        this.guard("finalizeRecipeScan", input.jobId, () => this.finalize.execute(input));

    markRecipeJobFailed = (input: FailRecipeJobInput): Promise<void> =>
        this.guard("markRecipeJobFailed", input.jobId, () => this.fail.execute(input));

    private guard<T>(activity: string, jobId: string, run: () => Promise<T>): Promise<T> {
        return guardActivity({ activity, jobId, isNonRetryable: isNonRetryableRecipeError }, run);
    }
}
