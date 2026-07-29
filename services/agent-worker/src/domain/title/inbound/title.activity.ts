import { Context } from "@temporalio/activity";
import { guardActivity } from "@tracer-agent/llm";
import type { FailTitleJobUsecase } from "~agent-worker/domain/title/application/fail.title.job.usecase.js";
import type { FinalizeTitleSuggestionUsecase } from "~agent-worker/domain/title/application/finalize.title.suggestion.usecase.js";
import type { PrepareTitleSuggestionUsecase } from "~agent-worker/domain/title/application/prepare.title.suggestion.usecase.js";
import type { SuggestTitleUsecase } from "~agent-worker/domain/title/application/suggest.title.usecase.js";
import { isNonRetryableTitleError } from "~agent-worker/domain/title/model/title.error.js";
import type {
    FailTitleJobInput,
    TitleSuggestionFinalizeInput,
    TitleSuggestionGenerateOutput,
    TitleSuggestionInput,
    TitleSuggestionPrep,
} from "~agent-worker/domain/title/model/title.job.model.js";

const HEARTBEAT_MS = 10_000;

/** 오케스트레이션 엔진의 활동 표면을 제목 제안 유스케이스에 잇는다. */
export class TitleActivity {
    constructor(
        private readonly prepare: PrepareTitleSuggestionUsecase,
        private readonly suggest: SuggestTitleUsecase,
        private readonly finalize: FinalizeTitleSuggestionUsecase,
        private readonly fail: FailTitleJobUsecase,
    ) {}

    prepareTitleSuggestion = (input: TitleSuggestionInput): Promise<TitleSuggestionPrep> =>
        this.guard("prepareTitleSuggestion", input.jobId, () => this.prepare.execute(input));

    generateTitleSuggestion = async (
        prep: TitleSuggestionPrep,
    ): Promise<TitleSuggestionGenerateOutput> => {
        const ctx = Context.current();
        const heartbeat = setInterval(() => Context.current().heartbeat(), HEARTBEAT_MS);
        try {
            return await this.guard("generateTitleSuggestion", prep.jobId, () =>
                this.suggest.execute(prep, {
                    attempt: ctx.info.attempt,
                    idempotencyKey: `${ctx.info.workflowExecution?.workflowId ?? prep.jobId}-${ctx.info.activityId}`,
                    abortSignal: ctx.cancellationSignal,
                }),
            );
        } finally {
            clearInterval(heartbeat);
        }
    };

    finalizeTitleSuggestion = (input: TitleSuggestionFinalizeInput): Promise<void> =>
        this.guard("finalizeTitleSuggestion", input.jobId, () => this.finalize.execute(input));

    markTitleJobFailed = (input: FailTitleJobInput): Promise<void> =>
        this.guard("markTitleJobFailed", input.jobId, () => this.fail.execute(input));

    private guard<T>(activity: string, jobId: string, run: () => Promise<T>): Promise<T> {
        return guardActivity({ activity, jobId, isNonRetryable: isNonRetryableTitleError }, run);
    }
}
