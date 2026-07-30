import type { GeneratedJobStep } from "@tracer-agent/llm";
import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import type { DataSource, EntityManager } from "typeorm";
import { readAppSetting } from "~agent-worker/config/app.setting.reader.js";
import { AiJobEntity } from "~agent-worker/config/ledger/ai.job.entity.js";
import { AiJobStepEntity } from "~agent-worker/config/ledger/ai.job.step.entity.js";
import { AgentRunObservationEntity } from "~agent-worker/config/ledger/agent.run.observation.entity.js";
import { JobTransitionLostError, isJobTransitionLost } from "~agent-worker/support/job.const.js";
import {
    NON_TERMINAL_JOB_STATUSES,
    TypeOrmAiJobRepository,
    TypeOrmAiJobStepRepository,
} from "~agent-worker/config/ledger/job.repository.js";
import { TypeOrmAgentRunObservationRepository } from "~agent-worker/config/ledger/observation.repository.js";
import { foldAttempt, type JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";
import { wireItems, wireNumber, wireObject, wireText } from "~agent-worker/support/wire.value.js";
import { buildTitleContext } from "~agent-worker/domain/title/model/title.context.model.js";
import type {
    TitleFailedAttempt,
    TitleJobSnapshot,
    TitleRepositoryPort,
    TitleSuggestionCommit,
    TitleTaskContext,
} from "~agent-worker/domain/title/port/title.repository.port.js";

/** 이 슬라이스의 저장 포트를 잡 원장과 추적 조회 창구로 구현한다. */
export class TitleRepositoryAdapter implements TitleRepositoryPort {
    constructor(
        private readonly dataSource: DataSource,
        private readonly tracer: TracerApiWindow,
    ) {}

    private jobs(manager: EntityManager = this.dataSource.manager): TypeOrmAiJobRepository {
        return new TypeOrmAiJobRepository(manager.getRepository(AiJobEntity));
    }

    async findJob(jobId: string): Promise<TitleJobSnapshot | null> {
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

    async findTaskContext(userId: string, taskId: string): Promise<TitleTaskContext | null> {
        const detail = await this.tracer.requestOrNull({
            method: "GET",
            path: `/api/v1/tasks/${encodeURIComponent(taskId)}`,
            userId,
        });
        if (detail === null) return null;
        const task = wireObject(wireObject(detail)["task"]);
        const workspacePath = wireText(task["workspacePath"]);

        const [timeline, turnPage] = await Promise.all([
            this.tracer.request({
                method: "GET",
                path: `/api/v1/tasks/${encodeURIComponent(taskId)}/timeline`,
                userId,
                query: { order: "asc", limit: 1 },
            }),
            this.tracer.request({
                method: "GET",
                path: `/api/v1/tasks/${encodeURIComponent(taskId)}/turns`,
                userId,
            }),
        ]);
        const totalEventCount = wireNumber(wireObject(timeline)["total"]) ?? 0;
        const context = buildTitleContext(
            {
                title: wireText(task["title"]) ?? "",
                status: wireText(task["status"]) ?? "",
                ...(workspacePath !== null ? { workspacePath } : {}),
            },
            wireItems(turnPage).map((turn) => ({
                turnIndex: wireNumber(turn["turnIndex"]) ?? 0,
                askedText: wireText(turn["askedText"]) ?? "",
                assistantText: wireText(turn["assistantText"]),
            })),
            totalEventCount,
        );
        return { ownedByUser: true, totalEventCount, context };
    }

    readSetting(scope: string, key: string): Promise<string | null> {
        return readAppSetting(this.dataSource, scope, key);
    }

    async recordFailedAttempt(input: TitleFailedAttempt): Promise<void> {
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

    async foldSuccessAttempt(
        jobId: string,
        record: JobAttemptRecord,
    ): Promise<{
        readonly attempts: readonly JobAttemptRecord[] | undefined;
        readonly costUsd: number | null;
    }> {
        const job = await this.jobs().findById(jobId);
        const { attempts, totalCostUsd } = foldAttempt(job?.usage ?? {}, record);
        if (attempts.length <= 1) return { attempts: undefined, costUsd: record.costUsd };
        return { attempts, costUsd: totalCostUsd ?? record.costUsd };
    }

    async commitSuggestions(
        input: TitleSuggestionCommit,
    ): Promise<{ readonly suggestionsCreated: number } | null> {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const jobs = this.jobs(manager);
                const job = await jobs.findById(input.jobId);
                if (job === null || job.isTerminal()) throw new JobTransitionLostError(input.jobId);

                await insertSteps(manager, job.id, input.userId, input.steps, input.attempt, input.now);
                // 태스크를 직접 개명하지 않고 후보만 남겨 사용자가 고르게 한다.
                job.complete({ suggestions: input.suggestions }, input.usage, input.now);
                if (!(await jobs.commitTransition(job, NON_TERMINAL_JOB_STATUSES))) {
                    throw new JobTransitionLostError(job.id);
                }
                await observations(manager).record(input.userId, input.observation, input.now);
                return { suggestionsCreated: input.suggestions.length };
            });
        } catch (error) {
            if (isJobTransitionLost(error)) return null;
            throw error;
        }
    }

    async failJob(jobId: string, message: string, now: Date): Promise<TitleJobSnapshot | null> {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const jobs = this.jobs(manager);
                const job = await jobs.findById(jobId);
                if (job === null || job.isTerminal()) throw new JobTransitionLostError(jobId);
                // 에이전트 실행 전에 실패했을 수 있으므로 관측 유무를 검사하지 않는다.
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

function toSnapshot(job: AiJobEntity): TitleJobSnapshot {
    return { id: job.id, userId: job.userId, taskId: job.taskId, usage: job.usage };
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
    if (steps.length === 0) return;
    await new TypeOrmAiJobStepRepository(manager.getRepository(AiJobStepEntity)).insertMany(
        steps.map((step) => AiJobStepEntity.create({ id: step.id, jobId, userId, attempt, step, now })),
    );
}
