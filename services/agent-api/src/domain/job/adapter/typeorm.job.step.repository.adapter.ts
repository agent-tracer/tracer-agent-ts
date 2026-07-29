import type { Repository } from "typeorm";
import type { JobStep } from "~agent-api/domain/job/model/job.step.model.js";
import type { JobStepRepositoryPort } from "~agent-api/domain/job/port/job.step.repository.port.js";
import { toJobStep, type JobStepEntity } from "./job.step.entity.js";

export class TypeOrmJobStepRepository implements JobStepRepositoryPort {
    constructor(private readonly repo: Repository<JobStepEntity>) {}

    async findByJobId(jobId: string, userId: string): Promise<JobStep[]> {
        const rows = await this.repo.find({
            where: { jobId, userId },
            order: { attempt: "ASC", seq: "ASC" },
        });
        return rows.map(toJobStep);
    }
}
