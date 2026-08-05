import { Inject, Injectable } from "@nestjs/common";
import { InvariantViolationError } from "@tracer-agent/platform";
import { JOB_STATUS } from "~agent-api/domain/job/model/job.const.js";
import { mapJob, type JobDto } from "~agent-api/domain/job/model/job.view.model.js";
import { JOB_STATUS_NOTIFIER, type JobStatusNotifier } from "~agent-api/domain/job/port/job.status.notifier.port.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";
import { WORKFLOW_DISPATCHER, type WorkflowDispatcherPort } from "~agent-api/domain/job/port/workflow.dispatcher.port.js";

/** 접수했거나 실행 중인 잡 하나를 중단하고 그 사실을 사용자에게 알린다. */
@Injectable()
export class CancelJobUseCase {
    constructor(
        @Inject(JOB_REPOSITORY) private readonly jobs: JobRepositoryPort,
        @Inject(WORKFLOW_DISPATCHER) private readonly dispatcher: WorkflowDispatcherPort,
        @Inject(JOB_STATUS_NOTIFIER) private readonly notifier: JobStatusNotifier,
    ) {}

    async execute(userId: string, id: string, now: Date): Promise<JobDto | null> {
        const job = await this.jobs.findById(id);
        // 남의 잡은 존재 여부도 드러내지 않는다.
        if (job === null || !job.isOwnedBy(userId)) return null;
        if (!job.isCancelable()) throw new InvariantViolationError("job.not-cancelable");

        // 전이를 먼저 하면 취소에 실패했을 때 취소됐다고 기록해 둔 채 유료 실행이 계속된다.
        await this.dispatcher.cancel(job.kind, job.id);

        const canceled = await this.jobs.transitionToCanceled(job.id, now);
        if (!canceled) throw new InvariantViolationError("job.not-cancelable");
        job.cancel(now);

        this.notifier.notify(userId, {
            jobId: job.id,
            kind: job.kind,
            status: JOB_STATUS.canceled,
            ...(job.taskId !== null ? { taskId: job.taskId } : {}),
        });

        return mapJob(job);
    }
}
