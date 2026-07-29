import type { JobStep } from "~agent-api/domain/job/model/job.step.model.js";

export const JOB_STEP_REPOSITORY = Symbol("JobStepRepository");

/** 잡이 남긴 궤적을 순서대로 조회하는 포트다. */
export interface JobStepRepositoryPort {
    findByJobId(jobId: string, userId: string): Promise<JobStep[]>;
}
