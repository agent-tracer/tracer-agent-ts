import { AgentExecutionFailure, isNonRetryableSubtype } from "@tracer-agent/llm";

/** 언어 모델 자격이 없어 재시도로 풀리지 않는 실패다. */
export class MissingApiKeyError extends Error {
    constructor(settingKey: string) {
        super(`No LLM API key configured. Set ${settingKey} in Settings.`);
        this.name = "MissingApiKeyError";
    }
}

/** 실행할 잡을 찾지 못한 실패다. */
export class JobNotFoundError extends Error {
    constructor(jobId: string) {
        super(`job not found: ${jobId}`);
        this.name = "JobNotFoundError";
    }
}

/** 대상 태스크가 없어 재시도로 풀리지 않는 실패다. */
export class TaskNotFoundError extends Error {
    constructor(taskId: string) {
        super(`task not found: ${taskId}`);
        this.name = "TaskNotFoundError";
    }
}

/** 잡이 이미 다른 전이로 종결된 실패다. */
export class JobAlreadySettledError extends Error {
    constructor(jobId: string) {
        super(`job already settled by another transition: ${jobId}`);
        this.name = "JobAlreadySettledError";
    }
}

/** 스캔 앵커 자격을 만족하지 못한 태스크다. */
export class TaskNotScannableError extends Error {
    constructor(taskId: string) {
        super(`task is not a recipe scan anchor: ${taskId}`);
        this.name = "TaskNotScannableError";
    }
}

const NON_RETRYABLE_ERRORS = [
    MissingApiKeyError,
    JobNotFoundError,
    TaskNotFoundError,
    JobAlreadySettledError,
    TaskNotScannableError,
] as const;

/** 재시도가 상태를 바꾸지 못하는 실패를 가른다. */
export function isNonRetryableRecipeError(err: unknown): boolean {
    if (NON_RETRYABLE_ERRORS.some((type) => err instanceof type)) return true;
    return err instanceof AgentExecutionFailure && isNonRetryableSubtype(err.errorSubtype);
}
