export const JOB_ID_GENERATOR = Symbol("JobIdGenerator");

export interface JobIdGeneratorPort {
    next(): string;
}
