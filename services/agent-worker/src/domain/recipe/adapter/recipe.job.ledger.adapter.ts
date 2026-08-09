import type { GeneratedJobStep } from "@tracer-agent/llm";
import type { DataSource, EntityManager } from "typeorm";
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
    RecipeFailedAttempt,
    RecipeJobLedgerPort,
    RecipeJobSnapshot,
    RecipeScanCommit,
} from "~agent-worker/domain/recipe/port/recipe.job.ledger.port.js";
import { JobTransitionLostError, isJobTransitionLost } from "~agent-worker/support/job.const.js";
import { foldAttempt, type JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";

/** 레시피 슬라이스의 잡 원장 포트를 agent-db 하나로 구현하며 트랜잭션 안에서는 manager만 쓴다. */
export class RecipeJobLedgerAdapter implements RecipeJobLedgerPort {
    constructor(private readonly dataSource: DataSource) {}

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

    async readSuccessAttemptUsage(jobId: string, record: JobAttemptRecord) {
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
                await insertSteps(manager, job.id, input.userId, input.steps, input.attempt, input.now);
                job.complete(
                    { recipes: input.recipes, provenance: input.provenance },
                    input.usage,
                    input.now,
                );
                if (!(await jobs.commitTransition(job, NON_TERMINAL_JOB_STATUSES))) {
                    throw new JobTransitionLostError(job.id);
                }
                await observations(manager).record(input.userId, input.observation, input.now);
                return { candidatesCreated: input.recipes.length };
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
