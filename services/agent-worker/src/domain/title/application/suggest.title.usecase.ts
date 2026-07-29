import { AgentExecutionFailure, assignStepIds, type AgentAttemptRun } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import {
    attemptRecordFromFailure,
    attemptRecordFromSuccess,
} from "~agent-worker/support/llm/job.attempt.js";
import { buildFailedRunObservation } from "~agent-worker/support/llm/run.observation.js";
import { TITLE_SETTING_KEY } from "~agent-worker/domain/title/model/title.const.js";
import type {
    TitleSuggestionGenerateOutput,
    TitleSuggestionPrep,
} from "~agent-worker/domain/title/model/title.job.model.js";
import { TITLE_SUGGESTION_SPEC } from "~agent-worker/domain/title/model/title.spec.js";
import { validateTitleSuggestions } from "~agent-worker/domain/title/model/title.validation.model.js";
import type { TitleAgentPort } from "~agent-worker/domain/title/port/title.agent.port.js";
import type { TitleIdGeneratorPort } from "~agent-worker/domain/title/port/title.id.generator.port.js";
import type { TitleRepositoryPort } from "~agent-worker/domain/title/port/title.repository.port.js";

/** 에이전트를 한 번 실행해 제목 후보를 만들고 시도 이력을 남긴다. */
export class SuggestTitleUsecase {
    constructor(
        private readonly repository: TitleRepositoryPort,
        private readonly agent: TitleAgentPort,
        private readonly clock: IClock,
        private readonly ids: TitleIdGeneratorPort,
    ) {}

    async execute(
        prep: TitleSuggestionPrep,
        run: AgentAttemptRun,
    ): Promise<TitleSuggestionGenerateOutput> {
        const agent = this.agent;
        const apiKey = agent.requiresLocalApiKey()
            ? await this.repository.readSetting(prep.userId, TITLE_SETTING_KEY.anthropicApiKey)
            : null;

        let output;
        try {
            output = await agent.generate({
                jobId: prep.jobId,
                userId: prep.userId,
                taskId: prep.taskId,
                language: prep.language,
                context: prep.context,
                prompt: prep.prompt,
                ...(apiKey !== null ? { apiKey } : {}),
                ...(prep.model !== undefined ? { model: prep.model } : {}),
                attempt: run.attempt,
                idempotencyKey: run.idempotencyKey,
                abortSignal: run.abortSignal,
            });
        } catch (err) {
            if (err instanceof AgentExecutionFailure) await this.recordFailure(prep, run.attempt, err);
            throw err;
        }

        // 실행기가 자기 수리 회차 안에서 이미 본 제약이지만 같은 판정을 통과한 제목만 저장한다.
        const rejected = validateTitleSuggestions(output.suggestions, prep.currentTitle);
        const suggestions = rejected.length === 0 ? output.suggestions : [];
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
            observation: rejected.length === 0
                ? output.observation
                : {
                    ...output.observation,
                    validation: {
                        ...output.observation.validation,
                        passed: false,
                        errorCodes: ["title_validation_failed"],
                    },
                },
        };
    }

    private async recordFailure(
        prep: TitleSuggestionPrep,
        attempt: number,
        err: AgentExecutionFailure,
    ): Promise<void> {
        const now = this.clock.now();
        await this.repository.recordFailedAttempt({
            jobId: prep.jobId,
            userId: prep.userId,
            steps: assignStepIds(err.steps, () => this.ids.next()),
            record: attemptRecordFromFailure(attempt, err),
            observation: err.observation
                ?? buildFailedRunObservation({
                    executionId: prep.jobId,
                    attempt,
                    jobId: prep.jobId,
                    agentName: TITLE_SUGGESTION_SPEC.name,
                    modelRequested: prep.model ?? TITLE_SUGGESTION_SPEC.limits.defaultModel,
                    promptVersion: prep.prompt.versionId,
                    promptFingerprint: {
                        agent: TITLE_SUGGESTION_SPEC.name,
                        version: prep.prompt.semanticVersion,
                        language: prep.language,
                        contentHash: prep.prompt.contentHash,
                    },
                    toolContractVersion: prep.prompt.toolContractVersion,
                    failure: err,
                }),
            now,
        });
    }
}
