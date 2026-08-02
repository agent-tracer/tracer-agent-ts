import { In, type QueryDeepPartialEntity, type Repository } from "typeorm";
import type { AiJobEntity } from "./ai.job.entity.js";
import { AiJobStageOutputEntity } from "./ai.job.stage.output.entity.js";
import { AiJobStepEntity } from "./ai.job.step.entity.js";
import { JOB_STATUS, type JobStatus } from "~agent-worker/support/job.const.js";

/** 종결 전이가 다른 실행에 밀리지 않았을 때만 원장에 닿게 하는 잡 원장 창구다. */
export class TypeOrmAiJobRepository {
    constructor(private readonly repo: Repository<AiJobEntity>) {}

    findById(id: string): Promise<AiJobEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    /** 읽은 시점의 상태가 그대로일 때만 전이를 새기며 밀렸으면 거짓을 낸다. */
    async commitTransition(job: AiJobEntity, expected: readonly JobStatus[]): Promise<boolean> {
        const patch = {
            status: job.status,
            attempts: job.attempts,
            result: job.result,
            usage: job.usage,
            error: job.error,
            updatedAt: job.updatedAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
        } as unknown as QueryDeepPartialEntity<AiJobEntity>;
        const result = await this.repo.update({ id: job.id, status: In([...expected]) }, patch);
        return result.affected === 1;
    }
}

/** 활동 재시도 회차까지 갈라 남기는 잡 궤적 창구다. */
export class TypeOrmAiJobStepRepository {
    constructor(private readonly repo: Repository<AiJobStepEntity>) {}

    async insertMany(steps: readonly AiJobStepEntity[]): Promise<void> {
        if (steps.length === 0) return;
        await this.repo
            .createQueryBuilder()
            .insert()
            .into(AiJobStepEntity)
            .values(steps as unknown as QueryDeepPartialEntity<AiJobStepEntity>[])
            .orIgnore()
            .execute();
    }
}

/** 끝난 단계의 산출을 잡 단위로 읽고 적으며 종결한 잡의 것은 지운다. */
export class TypeOrmAiJobStageOutputRepository {
    constructor(private readonly repo: Repository<AiJobStageOutputEntity>) {}

    async find(jobId: string, stage: string, slot: string): Promise<unknown> {
        const found = await this.repo.findOneBy({ jobId, stage, slot });
        return found === null ? null : found.payload;
    }

    async save(jobId: string, stage: string, slot: string, payload: unknown, now: Date): Promise<void> {
        // 같은 단계를 다시 돈 시도가 앞선 산출을 덮지 않도록 먼저 적힌 것을 남긴다.
        await this.repo
            .createQueryBuilder()
            .insert()
            .into(AiJobStageOutputEntity)
            .values({ jobId, stage, slot, payload, createdAt: now } as QueryDeepPartialEntity<AiJobStageOutputEntity>)
            .orIgnore()
            .execute();
    }

    async clear(jobId: string): Promise<void> {
        await this.repo.delete({ jobId });
    }
}

/** 종결 전이가 아직 가능한 상태이며 잡 원장의 갱신은 전부 이 집합을 기대한다. */
export const NON_TERMINAL_JOB_STATUSES: readonly JobStatus[] = [JOB_STATUS.pending, JOB_STATUS.running];
