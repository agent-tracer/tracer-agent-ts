import type { DataSource } from "typeorm";
import { AiJobStageOutputEntity } from "~agent-worker/config/ledger/ai.job.stage.output.entity.js";
import { TypeOrmAiJobStageOutputRepository } from "~agent-worker/config/ledger/job.repository.js";
import type {
    RecipeStage,
    RecipeStageOutputPort,
} from "~agent-worker/domain/recipe/port/recipe.stage.output.port.js";

/** 끝난 단계의 산출을 잡 원장의 표에 적고 되읽는다. */
export class RecipeStageOutputAdapter implements RecipeStageOutputPort {
    constructor(private readonly dataSource: DataSource) {}

    find(jobId: string, stage: RecipeStage, slot: string): Promise<unknown> {
        return this.repository().find(jobId, stage, slot);
    }

    save(jobId: string, stage: RecipeStage, slot: string, payload: unknown, now: Date): Promise<void> {
        return this.repository().save(jobId, stage, slot, payload, now);
    }

    clear(jobId: string): Promise<void> {
        return this.repository().clear(jobId);
    }

    private repository(): TypeOrmAiJobStageOutputRepository {
        return new TypeOrmAiJobStageOutputRepository(this.dataSource.getRepository(AiJobStageOutputEntity));
    }
}
