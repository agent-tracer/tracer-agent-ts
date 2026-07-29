import type { AgentRunObservation, GeneratedJobStep } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import { JOB_KIND, JOB_STATUS } from "~agent-worker/support/job.const.js";
import { buildJobUsage, type AgentUsageSummary } from "~agent-worker/support/llm/job.attempt.js";
import { taskCleanupSummary } from "../model/cleanup.suggestion.model.js";
import type { CleanupNotificationPort } from "../port/cleanup.notification.port.js";
import type { CleanupRepositoryPort } from "../port/cleanup.repository.port.js";
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

/** 제안 저장과 잡 종결을 한 커밋으로 묶고 결과를 알린다. */
export class FinalizeTaskCleanupUsecase {
    constructor(
        private readonly repository: CleanupRepositoryPort,
        private readonly notification: CleanupNotificationPort,
        private readonly clock: IClock,
    ) {}

    async execute(input: TaskCleanupFinalizeInput): Promise<void> {
        const now = this.clock.now();
        const output = input.output;
        const settled = await this.repository.commitCleanup({
            jobId: input.jobId,
            userId: input.userId,
            tasksScanned: input.tasksScanned,
            suggestions: output?.suggestions ?? [],
            steps: output?.jobSteps ?? [],
            attempt: output?.attempt ?? 1,
            usage: output !== null ? buildJobUsage(output) : {},
            observation: output?.observation ?? null,
            now,
        });
        if (settled === null) return;

        await this.notification.jobUpdated(input.userId, {
            jobId: input.jobId,
            kind: JOB_KIND.taskCleanup,
            status: JOB_STATUS.completed,
            summary: taskCleanupSummary(settled.suggestionsCreated, input.tasksScanned),
            durationMs: output?.durationMs ?? 0,
        });
    }
}
