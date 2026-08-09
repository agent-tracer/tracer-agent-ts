import type { GeneratedJobStep } from "@tracer-agent/llm";
import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import type { DataSource, EntityManager } from "typeorm";
import { readAppSetting } from "~agent-worker/config/app.setting.reader.js";
import { AgentRunObservationEntity } from "~agent-worker/config/ledger/agent.run.observation.entity.js";
import { AiJobEntity } from "~agent-worker/config/ledger/ai.job.entity.js";
import { AiJobStepEntity } from "~agent-worker/config/ledger/ai.job.step.entity.js";
import {
    NON_TERMINAL_JOB_STATUSES,
    TypeOrmAiJobRepository,
    TypeOrmAiJobStepRepository,
} from "~agent-worker/config/ledger/job.repository.js";
import { TypeOrmAgentRunObservationRepository } from "~agent-worker/config/ledger/observation.repository.js";
import type {
    CleanupCommit,
    CleanupFailedAttempt,
    CleanupJobSnapshot,
    CleanupRepositoryPort,
    CleanupScanBatch,
} from "~agent-worker/domain/cleanup/port/cleanup.repository.port.js";
import { JobTransitionLostError, isJobTransitionLost } from "~agent-worker/support/job.const.js";
import { foldAttempt, type JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";
import { loadCleanupScanBatch } from "./cleanup.task.scan.js";

/** cleanup 슬라이스의 저장 포트를 잡 원장과 추적 조회 창구로 구현한다. */
export class CleanupRepositoryAdapter implements CleanupRepositoryPort {
    constructor(
        private readonly dataSource: DataSource,
        private readonly tracer: TracerApiWindow,
    ) {}

    private jobs(manager: EntityManager = this.dataSource.manager): TypeOrmAiJobRepository {
        return new TypeOrmAiJobRepository(manager.getRepository(AiJobEntity));
    }

    async findJob(jobId: string): Promise<CleanupJobSnapshot | null> {
        const job = await this.jobs().findById(jobId);
        return job === null ? null : toSnapshot(job);
    }

    async startJob(jobId: string, now: Date): Promise<boolean> {
        const jobs = this.jobs();
        const job = await jobs.findById(jobId);
        if (job === null) return false;
        job.start(now);
        return jobs.commitTransition(job, NON_TERMINAL_JOB_STATUSES);
    }

    readSetting(scope: string, key: string): Promise<string | null> {
        return readAppSetting(this.dataSource, scope, key);
    }

    loadScanBatch(userId: string): Promise<CleanupScanBatch> {
        return loadCleanupScanBatch(this.tracer, userId);
    }

    async recordFailedAttempt(input: CleanupFailedAttempt): Promise<void> {
        try {
            await this.dataSource.transaction(async (manager) => {
                const jobs = this.jobs(manager);
                const job = await jobs.findById(input.jobId);
                if (job === null || job.isTerminal()) throw new JobTransitionLostError(input.jobId);
                const { attempts } = foldAttempt(job.usage, input.record);
                job.recordAttemptUsage({ attempts }, input.now);
                if (!(await jobs.commitTransition(job, NON_TERMINAL_JOB_STATUSES))) {
                    throw new JobTransitionLostError(input.jobId);
                }
                await insertSteps(manager, input.jobId, input.userId, input.steps, input.record.attempt, input.now);
                await observations(manager).record(input.userId, input.observation, input.now);
            });
        } catch (error) {
            if (isJobTransitionLost(error)) return;
            throw error;
        }
    }

    async readSuccessAttemptUsage(jobId: string, record: JobAttemptRecord) {
        const job = await this.jobs().findById(jobId);
        const { attempts, totalCostUsd } = foldAttempt(job?.usage ?? {}, record);
        if (attempts.length <= 1) return { attempts: undefined, costUsd: record.costUsd };
        return { attempts, costUsd: totalCostUsd ?? record.costUsd };
    }

    async commitCleanup(input: CleanupCommit): Promise<{ readonly suggestionsCreated: number } | null> {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const jobs = this.jobs(manager);
                const job = await jobs.findById(input.jobId);
                if (job === null || job.isTerminal()) throw new JobTransitionLostError(input.jobId);
                await insertSteps(manager, job.id, input.userId, input.steps, input.attempt, input.now);
                job.complete(
                    { suggestions: input.suggestions, tasksScanned: input.tasksScanned },
                    input.usage,
                    input.now,
                );
                if (!(await jobs.commitTransition(job, NON_TERMINAL_JOB_STATUSES))) {
                    throw new JobTransitionLostError(job.id);
                }
                if (input.observation !== null) {
                    await observations(manager).record(input.userId, input.observation, input.now);
                }
                return { suggestionsCreated: input.suggestions.length };
            });
        } catch (error) {
            if (isJobTransitionLost(error)) return null;
            throw error;
        }
    }

    async failJob(jobId: string, message: string, now: Date): Promise<CleanupJobSnapshot | null> {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const jobs = this.jobs(manager);
                const job = await jobs.findById(jobId);
                if (job === null || job.isTerminal()) throw new JobTransitionLostError(jobId);
                // 에이전트 실행 전 실패가 있을 수 있으므로 observation 유무를 검사하지 않는다.
                job.fail(message, now);
                if (!(await jobs.commitTransition(job, NON_TERMINAL_JOB_STATUSES))) {
                    throw new JobTransitionLostError(job.id);
                }
                return toSnapshot(job);
            });
        } catch (error) {
            if (isJobTransitionLost(error)) return null;
            throw error;
        }
    }
}

function observations(manager: EntityManager): TypeOrmAgentRunObservationRepository {
    return new TypeOrmAgentRunObservationRepository(manager.getRepository(AgentRunObservationEntity));
}

async function insertSteps(
    manager: EntityManager,
    jobId: string,
    userId: string,
    steps: readonly GeneratedJobStep[],
    attempt: number,
    now: Date,
): Promise<void> {
    await new TypeOrmAiJobStepRepository(manager.getRepository(AiJobStepEntity)).insertMany(
        steps.map((step) => AiJobStepEntity.create({ id: step.id, jobId, userId, attempt, step, now })),
    );
}

function toSnapshot(job: AiJobEntity): CleanupJobSnapshot {
    return { id: job.id, userId: job.userId, usage: job.usage };
}
