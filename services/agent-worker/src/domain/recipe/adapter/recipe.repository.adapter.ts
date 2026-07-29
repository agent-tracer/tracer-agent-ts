import type { GeneratedJobStep } from "@tracer-agent/llm";
import { In, type DataSource, type EntityManager } from "typeorm";
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
import { TaskEntity, TaskUserStateEntity } from "~agent-worker/config/ledger/tracer.entity.js";
import type { RecipeIdGeneratorPort } from "~agent-worker/domain/recipe/port/recipe.id.generator.port.js";
import type {
    RecipeFailedAttempt,
    RecipeJobSnapshot,
    RecipeRepositoryPort,
    RecipeScanCommit,
} from "~agent-worker/domain/recipe/port/recipe.repository.port.js";
import { JobTransitionLostError, isJobTransitionLost } from "~agent-worker/support/job.const.js";
import { foldAttempt, type JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";
import { persistRecipeCandidates } from "./recipe.candidate.persistence.js";

/** 레시피 슬라이스의 저장 포트를 잡 원장과 추적 읽기 모델로 구현한다. */
export class RecipeRepositoryAdapter implements RecipeRepositoryPort {
    constructor(
        private readonly dataSource: DataSource,
        private readonly ids: RecipeIdGeneratorPort,
    ) {}

    private jobs(manager: EntityManager = this.dataSource.manager): TypeOrmAiJobRepository {
        return new TypeOrmAiJobRepository(manager.getRepository(AiJobEntity));
    }

    async findJob(jobId: string): Promise<RecipeJobSnapshot | null> {
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

    async findAnchor(userId: string, taskId: string) {
        const task = await this.dataSource.getRepository(TaskEntity).findOneBy({ userId, id: taskId });
        if (task === null) return null;
        const state = await this.dataSource.getRepository(TaskUserStateEntity).findOneBy({ userId, taskId });
        const visible = state?.hiddenAt === null || state === null;
        const rootUserTask = task.origin !== "server-sdk" && task.parentTaskId === null;
        return {
            ownedByUser: true,
            scanEligible: visible && rootUserTask && task.status === "completed",
            sessionScanEligible: visible && rootUserTask,
        };
    }

    readSetting(scope: string, key: string): Promise<string | null> {
        return readAppSetting(this.dataSource, scope, key);
    }

    async findOwnedTaskIds(userId: string, taskIds: readonly string[]): Promise<readonly string[]> {
        if (taskIds.length === 0) return [];
        const rows = await this.dataSource.getRepository(TaskEntity).find({
            where: { userId, id: In([...taskIds]) },
            select: { id: true },
        });
        return rows.map(({ id }) => id);
    }

    async recordFailedAttempt(input: RecipeFailedAttempt): Promise<void> {
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

    async foldSuccessAttempt(jobId: string, record: JobAttemptRecord) {
        const job = await this.jobs().findById(jobId);
        const { attempts, totalCostUsd } = foldAttempt(job?.usage ?? {}, record);
        if (attempts.length <= 1) return { attempts: undefined, costUsd: record.costUsd };
        return { attempts, costUsd: totalCostUsd ?? record.costUsd };
    }

    async commitScan(input: RecipeScanCommit): Promise<{ readonly candidatesCreated: number } | null> {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const jobs = this.jobs(manager);
                const job = await jobs.findById(input.jobId);
                if (job === null || job.isTerminal()) throw new JobTransitionLostError(input.jobId);
                const candidatesCreated = await persistRecipeCandidates(
                    manager,
                    { userId: input.userId, language: input.language, sourceJobId: job.id },
                    input.recipes,
                    input.now,
                    this.ids,
                );
                await insertSteps(manager, job.id, input.userId, input.steps, input.attempt, input.now);
                job.complete({ candidatesCreated, sourceTaskId: input.sourceTaskId }, input.usage, input.now);
                if (!(await jobs.commitTransition(job, NON_TERMINAL_JOB_STATUSES))) {
                    throw new JobTransitionLostError(job.id);
                }
                await observations(manager).record(input.userId, input.observation, input.now);
                return { candidatesCreated };
            });
        } catch (error) {
            if (isJobTransitionLost(error)) return null;
            throw error;
        }
    }

    async failJob(jobId: string, message: string, now: Date): Promise<RecipeJobSnapshot | null> {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const jobs = this.jobs(manager);
                const job = await jobs.findById(jobId);
                if (job === null || job.isTerminal()) throw new JobTransitionLostError(jobId);
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

function toSnapshot(job: AiJobEntity): RecipeJobSnapshot {
    return { id: job.id, userId: job.userId, taskId: job.taskId, usage: job.usage };
}
