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
import { assembleCleanupSuggestions, type GeneratedCleanupSuggestion } from "../model/cleanup.suggestion.model.js";
import { CLEANUP_FEATURE, CLEANUP_SETTING_KEY } from "../model/cleanup.const.js";
import type { CleanupCandidate } from "../model/cleanup.candidate.model.js";
import type { CleanupAgentPort } from "../port/cleanup.agent.port.js";
import type { CleanupIdGeneratorPort } from "../port/cleanup.id.generator.port.js";
import type { CleanupRepositoryPort } from "../port/cleanup.repository.port.js";

export interface TaskCleanupPrep {
    readonly jobId: string;
    readonly userId: string;
    readonly language: OutputLanguage;
    readonly maxSuggestions: number;
    readonly candidates: readonly CleanupCandidate[];
    readonly truncated: boolean;
    readonly tasksScanned: number;
    readonly prompt: ResolvedAgentPrompt;
    readonly model?: string;
}

export interface TaskCleanupGenerateOutput extends AgentUsageSummary {
    readonly suggestions: readonly GeneratedCleanupSuggestion[];
    readonly jobSteps: readonly GeneratedJobStep[];
    readonly observation: AgentRunObservation;
    readonly usage: AgentQueryUsage | null;
}

/** 에이전트를 한 번 실행해 보관 제안을 만들고 시도 이력을 남긴다. */
export class SuggestCleanupUsecase {
    constructor(
        private readonly repository: CleanupRepositoryPort,
        private readonly agent: CleanupAgentPort,
        private readonly clock: IClock,
        private readonly ids: CleanupIdGeneratorPort,
    ) {}

    async execute(prep: TaskCleanupPrep, run: AgentAttemptRun): Promise<TaskCleanupGenerateOutput> {
        const apiKey = this.agent.requiresLocalApiKey()
            ? await this.repository.readSetting(prep.userId, CLEANUP_SETTING_KEY.anthropicApiKey)
            : null;

        let output;
        try {
            output = await this.agent.generate({
                prompt: prep.prompt,
                jobId: prep.jobId,
                userId: prep.userId,
                language: prep.language,
                scannedAt: this.clock.now().toISOString(),
                candidates: prep.candidates,
                truncated: prep.truncated,
                maxSuggestions: prep.maxSuggestions,
                ...(apiKey !== null ? { apiKey } : {}),
                ...(prep.model !== undefined ? { model: prep.model } : {}),
                attempt: run.attempt,
                idempotencyKey: run.idempotencyKey,
                abortSignal: run.abortSignal,
            });
        } catch (error) {
            if (error instanceof AgentExecutionFailure) await this.recordFailure(prep, run.attempt, error);
            throw error;
        }

        const suggestions = assembleCleanupSuggestions(
            output.suggestions,
            prep.candidates,
            prep.maxSuggestions,
            () => this.ids.next(),
        );
        const jobSteps = assignStepIds(output.steps, () => this.ids.next());

        const { attempts, costUsd } = await this.repository.foldSuccessAttempt(
            prep.jobId,
            attemptRecordFromSuccess(run.attempt, output),
        );

        return {
            modelUsed: output.modelUsed,
            durationMs: output.durationMs,
            costUsd,
            numTurns: output.numTurns,
            usage: output.usage,
            suggestions,
            jobSteps,
            attempt: run.attempt,
            attempts,
            observation: output.observation,
        };
    }

    private async recordFailure(prep: TaskCleanupPrep, attempt: number, error: AgentExecutionFailure): Promise<void> {
        await this.repository.recordFailedAttempt({
            jobId: prep.jobId,
            userId: prep.userId,
            steps: assignStepIds(error.steps, () => this.ids.next()),
            record: attemptRecordFromFailure(attempt, error),
            observation: error.observation ?? buildFailedRunObservation({
                executionId: prep.jobId,
                attempt,
                jobId: prep.jobId,
                agentName: AGENT.taskCleanup.id,
                modelRequested: prep.model ?? featureModels(CLEANUP_FEATURE)!.default,
                promptVersion: prep.prompt.versionId,
                promptFingerprint: {
                    agent: AGENT.taskCleanup.id,
                    version: prep.prompt.semanticVersion,
                    language: prep.language,
                    contentHash: prep.prompt.contentHash,
                },
                toolContractVersion: prep.prompt.toolContractVersion,
                failure: error,
            }),
            now: this.clock.now(),
        });
    }
}
