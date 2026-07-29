import type { GeneratedJobStep } from "@tracer-agent/llm";
import { type DataSource, type EntityManager } from "typeorm";
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
import type { CleanupTaskSnapshot } from "~agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import type {
    CleanupCommit,
    CleanupFailedAttempt,
    CleanupJobSnapshot,
    CleanupRepositoryPort,
    CleanupScanBatch,
} from "~agent-worker/domain/cleanup/port/cleanup.repository.port.js";
import { JobTransitionLostError, isJobTransitionLost } from "~agent-worker/support/job.const.js";
import { foldAttempt, type JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";
import { persistCleanupSuggestions } from "./cleanup.suggestion.persistence.js";

/** 서버 자신의 에이전트가 만든 태스크를 나타내는 출처 값이며 정리 대상에서 뺀다. */
const SERVER_SDK_TASK_ORIGIN = "server-sdk";
const TASK_SCAN_LIMIT = 500;

/** cleanup 슬라이스의 저장 포트를 잡 원장과 추적 읽기 모델로 구현한다. */
export class CleanupRepositoryAdapter implements CleanupRepositoryPort {
    constructor(private readonly dataSource: DataSource) {}

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

    async loadScanBatch(userId: string): Promise<CleanupScanBatch> {
        const rows = await this.dataSource
            .getRepository(TaskEntity)
            .createQueryBuilder("t")
            .leftJoin("task_user_state", "s", "s.task_id = t.id AND s.user_id = :userId", { userId })
            .where("t.user_id = :userId", { userId })
            .andWhere("s.archived_at IS NULL")
            .orderBy("t.updated_at", "DESC")
            .addOrderBy("t.id", "DESC")
            .limit(TASK_SCAN_LIMIT + 1)
            .getMany();
        const truncated = rows.length > TASK_SCAN_LIMIT;
        const limited = truncated ? rows.slice(0, TASK_SCAN_LIMIT) : rows;
        // 서버 에이전트가 만든 태스크는 사용자 정리 대상이 아니다.
        const userTasks = limited.filter((task) => task.origin !== SERVER_SDK_TASK_ORIGIN);
        const hidden = await this.hiddenTaskIds(userId, userTasks.map((task) => task.id));
        const visible = userTasks.filter((task) => !hidden.has(task.id));

        const activeChildren = await this.findActiveChildren(userId, visible.map((task) => task.id));
        return {
            tasks: visible.map(toTaskSnapshot),
            activeChildParentIds: activeChildren
                .map((child) => child.parentTaskId)
                .filter((parentId): parentId is string => parentId !== null),
            truncated,
            tasksScanned: userTasks.length,
        };
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

    async foldSuccessAttempt(jobId: string, record: JobAttemptRecord) {
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

                const suggestionsCreated = await persistCleanupSuggestions(
                    manager,
                    input.userId,
                    job.id,
                    input.suggestions,
                    input.now,
                );
                await insertSteps(manager, job.id, input.userId, input.steps, input.attempt, input.now);
                job.complete({ suggestionsCreated, tasksScanned: input.tasksScanned }, input.usage, input.now);
                if (!(await jobs.commitTransition(job, NON_TERMINAL_JOB_STATUSES))) {
                    throw new JobTransitionLostError(job.id);
                }
                if (input.observation !== null) {
                    await observations(manager).record(input.userId, input.observation, input.now);
                }
                return { suggestionsCreated };
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

    private async findActiveChildren(userId: string, parentTaskIds: readonly string[]): Promise<TaskEntity[]> {
        if (parentTaskIds.length === 0) return [];
        return this.dataSource
            .getRepository(TaskEntity)
            .createQueryBuilder("t")
            .where("t.user_id = :userId", { userId })
            .andWhere("t.parent_task_id IN (:...parentTaskIds)", { parentTaskIds: [...parentTaskIds] })
            .andWhere("t.status IN (:...statuses)", { statuses: ["running", "waiting"] })
            .getMany();
    }

    private async hiddenTaskIds(userId: string, taskIds: readonly string[]): Promise<ReadonlySet<string>> {
        if (taskIds.length === 0) return new Set();
        const rows = await this.dataSource
            .getRepository(TaskUserStateEntity)
            .createQueryBuilder("s")
            .where("s.user_id = :userId", { userId })
            .andWhere("s.task_id IN (:...taskIds)", { taskIds: [...taskIds] })
            .andWhere("s.hidden_at IS NOT NULL")
            .getMany();
        return new Set(rows.map((state) => state.taskId));
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

function toTaskSnapshot(task: TaskEntity): CleanupTaskSnapshot {
    return {
        id: task.id,
        title: task.title,
        status: task.status,
        lastEventAt: task.lastEventAt !== null ? task.lastEventAt.toISOString() : null,
        updatedAt: task.updatedAt.toISOString(),
    };
}

function toSnapshot(job: AiJobEntity): CleanupJobSnapshot {
    return { id: job.id, userId: job.userId, usage: job.usage };
}
