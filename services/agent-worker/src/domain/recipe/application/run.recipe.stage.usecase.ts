import type { StructuredSchema } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import type {
    RecipeStage,
    RecipeStageOutputPort,
    RecipeStageResumePort,
} from "~agent-worker/domain/recipe/port/recipe.stage.output.port.js";

/** 단계 하나를 실행하되 앞선 시도가 이미 낸 산출이 있으면 그것을 그대로 쓴다. */
export class RunRecipeStageUsecase {
    constructor(
        private readonly outputs: RecipeStageOutputPort,
        private readonly clock: IClock,
    ) {}

    /** 앞선 시도가 이미 낸 산출이며 없거나 되살릴 수 없으면 null 이다. */
    async restore<T>(
        jobId: string,
        stage: RecipeStage,
        slot: string,
        schema: StructuredSchema<T>,
    ): Promise<T | null> {
        const stored = await this.outputs.find(jobId, stage, slot);
        if (stored === null) return null;
        const parsed = schema.safeParse(stored);
        // 계약의 판이 바뀌어 되살릴 수 없는 산출은 없는 것으로 본다.
        return parsed.success ? parsed.data : null;
    }

    /** 이 시도가 낸 산출을 적어 다음 시도가 이 단계를 다시 실행하지 않게 한다. */
    async record(jobId: string, stage: RecipeStage, slot: string, payload: unknown): Promise<void> {
        await this.outputs.save(jobId, stage, slot, payload, this.clock.now());
    }

    async execute<T>(
        jobId: string,
        stage: RecipeStage,
        slot: string,
        schema: StructuredSchema<T>,
        run: () => Promise<T>,
    ): Promise<T> {
        const stored = await this.restore(jobId, stage, slot, schema);
        if (stored !== null) return stored;
        const produced = await run();
        await this.record(jobId, stage, slot, produced);
        return produced;
    }

    /** 잡 하나에 묶어 조사 실행이 그 잡의 자리만 보게 한다. */
    forJob(jobId: string): RecipeStageResumePort {
        return {
            restore: <T>(stage: RecipeStage, slot: string, schema: StructuredSchema<T>) =>
                this.restore(jobId, stage, slot, schema),
            record: (stage: RecipeStage, slot: string, payload: unknown) =>
                this.record(jobId, stage, slot, payload),
        };
    }
}
