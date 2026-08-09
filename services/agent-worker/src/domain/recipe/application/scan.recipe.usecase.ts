import type { ProvenanceSnapshot } from "~agent-worker/domain/recipe/model/recipe.provenance.model.js";
import {
    AgentExecutionFailure,
    assignStepIds,
    featureModels,
    type AgentAttemptRun,
    type AgentQueryUsage,
    type AgentRunObservation,
    type GeneratedJobStep,
    type ResolvedAgentPrompt,
} from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import {
    attemptRecordFromFailure,
    attemptRecordFromSuccess,
    type AgentUsageSummary,
} from "~agent-worker/support/llm/job.attempt.js";
import { buildFailedRunObservation } from "~agent-worker/support/llm/run.observation.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import { assembleRecipeCandidates, type GeneratedRecipeCandidate } from "../model/recipe.candidate.model.js";
import { RECIPE_FEATURE, RECIPE_SETTING_KEY } from "../model/recipe.const.js";
import type { RecipeAgentPort } from "../port/recipe.agent.port.js";
import type { IdGeneratorPort } from "~agent-worker/support/id.generator.port.js";
import type { RecipeJobLedgerPort } from "../port/recipe.job.ledger.port.js";
import type { RecipeSettingReaderPort } from "../port/setting.reader.port.js";
import type { RecipeTaskReaderPort } from "../port/recipe.task.reader.port.js";

export interface RecipeScanPrep {
    readonly jobId: string;
    readonly userId: string;
    readonly taskId: string;
    readonly language: OutputLanguage;
    readonly prompt: ResolvedAgentPrompt;
    readonly model?: string;
    readonly userPrompt?: string;
}

export interface RecipeScanGenerateOutput extends AgentUsageSummary {
    readonly recipes: readonly GeneratedRecipeCandidate[];
    readonly provenance: ProvenanceSnapshot;
    readonly jobSteps: readonly GeneratedJobStep[];
    readonly observation: AgentRunObservation;
    readonly usage: AgentQueryUsage | null;
}

/** 에이전트를 한 번 실행해 레시피 후보를 만들고 시도 이력을 남긴다. */
export class ScanRecipeUsecase {
    constructor(
        private readonly jobs: RecipeJobLedgerPort,
        private readonly settings: RecipeSettingReaderPort,
        private readonly tasks: RecipeTaskReaderPort,
        private readonly agent: RecipeAgentPort,
        private readonly clock: IClock,
        private readonly ids: IdGeneratorPort,
    ) {}

    async execute(prep: RecipeScanPrep, run: AgentAttemptRun): Promise<RecipeScanGenerateOutput> {
        const apiKey = this.agent.requiresLocalApiKey()
            ? await this.settings.findValue(prep.userId, RECIPE_SETTING_KEY.anthropicApiKey)
            : null;

        let output;
        try {
            output = await this.agent.generate({
                prompt: prep.prompt,
                jobId: prep.jobId,
                userId: prep.userId,
                taskId: prep.taskId,
                language: prep.language,
                ...(apiKey !== null ? { apiKey } : {}),
                ...(prep.model !== undefined ? { model: prep.model } : {}),
                ...(prep.userPrompt !== undefined ? { userPrompt: prep.userPrompt } : {}),
                attempt: run.attempt,
                idempotencyKey: run.idempotencyKey,
                abortSignal: run.abortSignal,
            });
        } catch (error) {
            if (error instanceof AgentExecutionFailure) {
                await this.recordFailure(prep, run.attempt, error);
            }
            throw error;
        }

        const citedTaskIds = [
            ...new Set(output.recipes.flatMap((recipe) =>
                recipe.contributing_slices.map((slice) => slice.taskId))),
        ];
        const ownedTaskIds = new Set(
            await this.tasks.findOwnedTaskIds(prep.userId, citedTaskIds),
        );
        const recipes = assembleRecipeCandidates(output.recipes, ownedTaskIds, output.provenance);
        const jobSteps = assignStepIds(output.steps, () => this.ids.next());
        const { attempts, costUsd } = await this.jobs.readSuccessAttemptUsage(
            prep.jobId,
            attemptRecordFromSuccess(run.attempt, output),
        );

        return {
            modelUsed: output.modelUsed,
            durationMs: output.durationMs,
            costUsd,
            numTurns: output.numTurns,
            usage: output.usage,
            recipes,
            provenance: output.provenance,
            jobSteps,
            attempt: run.attempt,
            attempts,
            observation: output.observation,
        };
    }

    private async recordFailure(
        prep: RecipeScanPrep,
        attempt: number,
        error: AgentExecutionFailure,
    ): Promise<void> {
        await this.jobs.recordFailedAttempt({
            jobId: prep.jobId,
            userId: prep.userId,
            steps: assignStepIds(error.steps, () => this.ids.next()),
            record: attemptRecordFromFailure(attempt, error),
            observation: error.observation ?? buildFailedRunObservation({
                executionId: prep.jobId,
                attempt,
                jobId: prep.jobId,
                agentName: AGENT.recipeScan.id,
                modelRequested: prep.model ?? featureModels(RECIPE_FEATURE)!.default,
                promptVersion: prep.prompt.promptVersion,
                toolContractVersion: prep.prompt.toolContractVersion,
                failure: error,
            }),
            now: this.clock.now(),
        });
    }
}
