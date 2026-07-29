import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    agentNameForJobKind,
    buildJobCandidate,
    type ExecutionExampleCandidate,
} from "~agent-api/domain/evaluation/model/execution.example.candidate.model.js";
import {
    EVALUATION_EXECUTION_READER,
    type EvaluationExecutionReaderPort,
} from "~agent-api/domain/evaluation/port/execution.reader.port.js";

@Injectable()
export class BuildExecutionExampleCandidateUseCase {
    constructor(
        @Inject(EVALUATION_EXECUTION_READER) private readonly executions: EvaluationExecutionReaderPort,
    ) {}

    async execute(userId: string, jobId: string): Promise<ExecutionExampleCandidate> {
        const job = await this.executions.findJobById(jobId);
        if (job === null || job.userId !== userId) throw new NotFoundException("Job not found");
        if (job.status !== "completed") throw new ConflictException("Job is not completed");
        if (agentNameForJobKind(job.kind) === null) {
            throw new ConflictException(`Job kind ${job.kind} is not evaluable`);
        }
        return buildJobCandidate(job, await this.executions.findJobSteps(jobId, userId));
    }
}
