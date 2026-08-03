import { AgentExecutionFailure, isNonRetryableSubtype } from "@tracer-agent/llm";

/** 언어 모델 자격 증명이 없어 재시도로 풀리지 않는 실패다. */
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

/** 잡이 이미 다른 전이로 종결된 실패다. */
export class JobAlreadySettledError extends Error {
    constructor(jobId: string) {
        super(`job already settled by another transition: ${jobId}`);
        this.name = "JobAlreadySettledError";
    }
}

const NON_RETRYABLE_ERRORS = [
    MissingApiKeyError, JobNotFoundError, JobAlreadySettledError,
] as const;

/** 재시도가 상태를 바꾸지 못하는 실패를 구분한다. */
export function isNonRetryableCleanupError(err: unknown): boolean {
    if (NON_RETRYABLE_ERRORS.some((type) => err instanceof type)) return true;
    return err instanceof AgentExecutionFailure && isNonRetryableSubtype(err.errorSubtype);
}
