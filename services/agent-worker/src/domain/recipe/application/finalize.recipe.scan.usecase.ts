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

/** 후보 저장과 잡 종결을 한 커밋으로 묶고 결과를 알린다. */
export class FinalizeRecipeScanUsecase {
    constructor(
        private readonly repository: RecipeRepositoryPort,
        private readonly notification: RecipeNotificationPort,
        private readonly clock: IClock,
    ) {}

    async execute(input: RecipeScanFinalizeInput): Promise<void> {
        const settled = await this.repository.commitScan({
            jobId: input.jobId,
            userId: input.userId,
            sourceTaskId: input.sourceTaskId,
            language: input.language,
            recipes: input.output.recipes,
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
