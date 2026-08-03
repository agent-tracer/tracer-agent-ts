import type { IClock } from "@tracer-agent/platform";
import { JOB_KIND, JOB_STATUS } from "~agent-worker/support/job.const.js";
import type { JobNotificationPort } from "~agent-worker/support/job.notification.port.js";
import type { RecipeRepositoryPort } from "../port/recipe.repository.port.js";
import type { RecipeStageOutputPort } from "~agent-worker/domain/recipe/port/recipe.stage.output.port.js";

const ERROR_LIMIT = 1000;
const SUMMARY_LIMIT = 240;

export interface FailRecipeJobInput {
    readonly jobId: string;
    readonly message: string;
}

/** 워크플로가 재시도를 모두 소진한 뒤에만 불러 잡을 실패로 종결한다. */
export class FailRecipeJobUsecase {
    constructor(
        private readonly repository: RecipeRepositoryPort,
        private readonly notification: JobNotificationPort,
        private readonly clock: IClock,
        private readonly stageOutputs: RecipeStageOutputPort | null = null,
    ) {}

    async execute(input: FailRecipeJobInput): Promise<void> {
        const failed = await this.repository.failJob(
            input.jobId,
            truncate(input.message, ERROR_LIMIT),
            this.clock.now(),
        );
        if (failed === null) return;
        // 실패도 종결이라 그 잡은 다시 돌지 않으므로 단계 산출을 원장에 남기지 않는다.
        await this.stageOutputs?.clear(input.jobId);

        await this.notification.jobUpdated(failed.userId, {
            jobId: failed.id,
            kind: JOB_KIND.recipeScan,
            status: JOB_STATUS.failed,
            error: truncate(input.message, SUMMARY_LIMIT),
        });
    }
}

function truncate(value: string, limit: number): string {
    return value.length <= limit ? value : `${value.slice(0, limit)}...`;
}
