import type { AgentRunObservation, GeneratedJobStep } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import { JOB_KIND, JOB_STATUS } from "~agent-worker/support/job.const.js";
import { buildJobUsage, type AgentUsageSummary } from "~agent-worker/support/llm/job.attempt.js";
import { taskCleanupSummary } from "../model/cleanup.suggestion.model.js";
import type { JobNotificationPort } from "~agent-worker/support/job.notification.port.js";
import type { CleanupOutputPort } from "../port/cleanup.output.port.js";
import type { CleanupJobLedgerPort } from "../port/cleanup.job.ledger.port.js";
import type { GeneratedCleanupSuggestion } from "../model/cleanup.suggestion.model.js";

export interface TaskCleanupFinalizeOutput extends AgentUsageSummary {
    readonly suggestions: readonly GeneratedCleanupSuggestion[];
    readonly jobSteps: readonly GeneratedJobStep[];
    readonly observation: AgentRunObservation;
}

export interface TaskCleanupFinalizeInput {
    readonly jobId: string;
    readonly userId: string;
    readonly tasksScanned: number;
    /** 후보 태스크가 없어 언어 모델 호출을 생략했으면 null이다. */
    readonly output: TaskCleanupFinalizeOutput | null;
}

/** 제안을 산출물 창구에 맡긴 뒤 잡 원장을 종결하고 결과를 알린다. */
export class FinalizeTaskCleanupUsecase {
    constructor(
        private readonly jobs: CleanupJobLedgerPort,
        private readonly output: CleanupOutputPort,
        private readonly notification: JobNotificationPort,
        private readonly clock: IClock,
    ) {}

    async execute(input: TaskCleanupFinalizeInput): Promise<void> {
        const now = this.clock.now();
        const generated = input.output;
        // 산출물이 먼저 자리를 잡아야 재시도가 잡 종결 뒤에 제안을 잃지 않는다.
        const suggestions = generated?.suggestions ?? [];
        await this.output.createSuggestions({
            userId: input.userId,
            jobId: input.jobId,
            suggestions,
        });
        const settled = await this.jobs.commitCleanup({
            jobId: input.jobId,
            userId: input.userId,
            tasksScanned: input.tasksScanned,
            suggestions,
            steps: generated?.jobSteps ?? [],
            attempt: generated?.attempt ?? 1,
            usage: generated !== null ? buildJobUsage(generated) : {},
            observation: generated?.observation ?? null,
            now,
        });
        if (settled === null) return;

        await this.notification.jobUpdated(input.userId, {
            jobId: input.jobId,
            kind: JOB_KIND.taskCleanup,
            status: JOB_STATUS.completed,
            summary: taskCleanupSummary(settled.suggestionsCreated, input.tasksScanned),
            durationMs: generated?.durationMs ?? 0,
        });
    }
}
