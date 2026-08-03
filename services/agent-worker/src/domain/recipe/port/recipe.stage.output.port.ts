import type { StructuredSchema } from "@tracer-agent/llm";

/** 잡 하나가 나뉘어 실행되는 단계이며 산출을 원장에 적는 자리를 이 이름이 구분한다. */
export const RECIPE_STAGE = {
    survey: "survey",
    probe: "probe",
    synthesize: "synthesize",
    repair: "repair",
} as const;

export type RecipeStage = (typeof RECIPE_STAGE)[keyof typeof RECIPE_STAGE];

/** 끝난 단계의 산출을 잡 단위로 읽고 적으며 종결한 잡의 것은 지운다. */
export interface RecipeStageOutputPort {
    find(jobId: string, stage: RecipeStage, slot: string): Promise<unknown>;
    save(jobId: string, stage: RecipeStage, slot: string, payload: unknown, now: Date): Promise<void>;
    clear(jobId: string): Promise<void>;
}

/** 조사 단계가 앞선 시도의 산출을 이어받는 자리이며 없으면 그 실행은 매번 처음부터 실행한다. */
export interface RecipeStageResumePort {
    restore<T>(stage: RecipeStage, slot: string, schema: StructuredSchema<T>): Promise<T | null>;
    record(stage: RecipeStage, slot: string, payload: unknown): Promise<void>;
}

/** 잡 하나의 이어받기를 내는 자리이며 조사 실행은 이 자리만 안다. */
export interface RecipeStageResumeSource {
    forJob(jobId: string): RecipeStageResumePort;
}
