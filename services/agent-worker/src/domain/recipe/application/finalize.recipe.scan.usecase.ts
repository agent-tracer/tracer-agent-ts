import type { IClock } from "@tracer-agent/platform";
import type { AgentRunObservation, GeneratedJobStep } from "@tracer-agent/llm";
import { JOB_KIND, JOB_STATUS } from "~agent-worker/support/job.const.js";
import {
    buildJobUsage,
    type AgentUsageSummary,
} from "~agent-worker/support/llm/job.attempt.js";
import {
    recipeScanSummary,
    type GeneratedRecipeCandidate,
} from "../model/recipe.candidate.model.js";
import type { RecipeNotificationPort } from "../port/recipe.notification.port.js";
import type { RecipeOutputPort } from "../port/recipe.output.port.js";
import type { RecipeRepositoryPort } from "../port/recipe.repository.port.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";

export interface RecipeScanFinalizeOutput extends AgentUsageSummary {
    readonly recipes: readonly GeneratedRecipeCandidate[];
    readonly jobSteps: readonly GeneratedJobStep[];
    readonly observation: AgentRunObservation;
}

export interface RecipeScanFinalizeInput {
    readonly jobId: string;
    readonly userId: string;
    readonly sourceTaskId: string;
    readonly language: OutputLanguage;
    readonly output: RecipeScanFinalizeOutput;
}

/** 후보를 산출물 창구에 맡긴 뒤 잡 원장을 종결하고 결과를 알린다. */
export class FinalizeRecipeScanUsecase {
    constructor(
        private readonly repository: RecipeRepositoryPort,
        private readonly output: RecipeOutputPort,
        private readonly notification: RecipeNotificationPort,
        private readonly clock: IClock,
    ) {}

    async execute(input: RecipeScanFinalizeInput): Promise<void> {
        // 산출물이 먼저 자리를 잡아야 재시도가 잡 종결 뒤에 후보를 잃지 않는다.
        const candidatesCreated = await this.output.createCandidates({
            userId: input.userId,
            language: input.language,
            sourceJobId: input.jobId,
            recipes: input.output.recipes,
        });
        const settled = await this.repository.commitScan({
            jobId: input.jobId,
            userId: input.userId,
            sourceTaskId: input.sourceTaskId,
            candidatesCreated,
            steps: input.output.jobSteps,
            attempt: input.output.attempt,
            usage: buildJobUsage(input.output),
            observation: input.output.observation,
            now: this.clock.now(),
        });
        if (settled === null) return;

        await this.notification.jobUpdated(input.userId, {
            jobId: input.jobId,
            kind: JOB_KIND.recipeScan,
            status: JOB_STATUS.completed,
            summary: recipeScanSummary(settled.candidatesCreated),
            durationMs: input.output.durationMs,
        });
    }
}
