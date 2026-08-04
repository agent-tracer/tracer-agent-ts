import type { ProvenanceSnapshot } from "~agent-worker/domain/recipe/model/recipe.provenance.model.js";
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
import type { JobNotificationPort } from "~agent-worker/support/job.notification.port.js";
import type { RecipeOutputPort } from "../port/recipe.output.port.js";
import type { RecipeRepositoryPort } from "../port/recipe.repository.port.js";
import type { RecipeStageOutputPort } from "~agent-worker/domain/recipe/port/recipe.stage.output.port.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";

export interface RecipeScanFinalizeOutput extends AgentUsageSummary {
    readonly recipes: readonly GeneratedRecipeCandidate[];
    readonly provenance: ProvenanceSnapshot;
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
        private readonly notification: JobNotificationPort,
        private readonly clock: IClock,
        private readonly stageOutputs: RecipeStageOutputPort | null = null,
    ) {}

    async execute(input: RecipeScanFinalizeInput): Promise<void> {
        // 산출물이 먼저 자리를 잡아야 재시도가 잡 종결 뒤에 후보를 잃지 않는다.
        await this.output.createCandidates({
            userId: input.userId,
            language: input.language,
            sourceJobId: input.jobId,
            recipes: input.output.recipes,
        });
        // 종결한 잡은 다시 시도하지 않으므로 그 단계 산출을 원장에 남기지 않는다.
        await this.stageOutputs?.clear(input.jobId);
        const settled = await this.repository.commitScan({
            jobId: input.jobId,
            userId: input.userId,
            recipes: input.output.recipes,
            provenance: input.output.provenance,
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
