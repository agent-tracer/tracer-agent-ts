import type { JobStep } from "~agent-api/domain/job/model/job.step.model.js";
import type { JobStepRepositoryPort } from "~agent-api/domain/job/port/job.step.repository.port.js";

/** 잡 궤적 저장소 포트의 인메모리 대역이다. */
export class InMemoryJobStepRepository implements JobStepRepositoryPort {
    private readonly rows: JobStep[] = [];

    seed(...steps: readonly JobStep[]): void {
        this.rows.push(...steps);
    }

    findByJobId(jobId: string, userId: string): Promise<JobStep[]> {
        return Promise.resolve(
            this.rows
                .filter((step) => step.jobId === jobId && step.userId === userId)
                .sort((left, right) => left.attempt - right.attempt || left.seq - right.seq),
        );
    }
}
