import { Inject, Injectable } from "@nestjs/common";
import type { JobStep } from "~agent-api/domain/job/model/job.step.model.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";
import { JOB_STEP_REPOSITORY, type JobStepRepositoryPort } from "~agent-api/domain/job/port/job.step.repository.port.js";

/** 궤적 한 줄의 와이어 표현이며 값이 없는 자리는 싣지 않는다. */
export type JobStepDto = Omit<JobStep, "id" | "jobId" | "userId" | "createdAt" | "toolCalls">
& { readonly toolCalls: readonly unknown[] };

/** 소유한 잡의 실행 궤적을 순서대로 조회한다. */
@Injectable()
export class GetJobStepsUseCase {
    constructor(
        @Inject(JOB_REPOSITORY)
        private readonly jobs: JobRepositoryPort,
        @Inject(JOB_STEP_REPOSITORY)
        private readonly jobSteps: JobStepRepositoryPort,
    ) {}

    async execute(userId: string, jobId: string): Promise<readonly JobStepDto[] | null> {
        const job = await this.jobs.findById(jobId);
        if (job === null || !job.isOwnedBy(userId)) return null;
        return (await this.jobSteps.findByJobId(jobId, userId)).map(mapJobStep);
    }
}

function mapJobStep(step: JobStep): JobStepDto {
    return {
        seq: step.seq,
        attempt: step.attempt,
        role: step.role,
        content: step.content,
        truncated: step.truncated,
        toolCalls: step.toolCalls ?? [],
        ...(step.toolName !== null ? { toolName: step.toolName } : {}),
        ...(step.toolCallId !== null ? { toolCallId: step.toolCallId } : {}),
        ...(step.inputTokens !== null ? { inputTokens: step.inputTokens } : {}),
        ...(step.outputTokens !== null ? { outputTokens: step.outputTokens } : {}),
        ...(step.cacheReadTokens !== null ? { cacheReadTokens: step.cacheReadTokens } : {}),
        ...(step.cacheCreationTokens !== null ? { cacheCreationTokens: step.cacheCreationTokens } : {}),
        ...(step.stopReason !== null ? { stopReason: step.stopReason } : {}),
        ...(step.nodeName !== null ? { nodeName: step.nodeName } : {}),
        ...(step.eventKind !== null ? { eventKind: step.eventKind } : {}),
        ...(step.durationMs !== null ? { durationMs: step.durationMs } : {}),
    } as JobStepDto;
}
