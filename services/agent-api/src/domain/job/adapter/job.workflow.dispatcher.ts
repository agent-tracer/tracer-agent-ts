import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { logInfo, logWarn } from "@tracer-agent/platform";
import { JOB_TASK_QUEUE, JOB_WORKFLOW_BY_KIND } from "~agent-api/config/job.queue.const.js";
import { createTemporalConnection, isWorkflowNotFound, type TemporalHandle } from "~agent-api/config/temporal.factory.js";
import type { JobKind } from "~agent-api/domain/job/model/job.const.js";
import type {
    WorkflowCancelOutcome,
    WorkflowDispatcherPort,
} from "~agent-api/domain/job/port/workflow.dispatcher.port.js";

/** 잡 워크플로를 워크플로 엔진에 시작하고 취소하는 어댑터다. */
@Injectable()
export class JobWorkflowDispatcher implements WorkflowDispatcherPort, OnModuleDestroy {
    private handle: Promise<TemporalHandle> | null = null;

    async start(kind: JobKind, jobId: string, userId: string, input: Record<string, unknown>): Promise<void> {
        const workflowType = JOB_WORKFLOW_BY_KIND[kind];
        if (workflowType === undefined) throw new Error(`no workflow mapped for job kind: ${kind}`);
        const workflowId = `${kind}:${jobId}`;
        const { client } = await this.connection();
        await client.workflow.start(workflowType, {
            taskQueue: JOB_TASK_QUEUE,
            workflowId,
            workflowIdConflictPolicy: "USE_EXISTING",
            workflowIdReusePolicy: "REJECT_DUPLICATE",
            args: [{ ...input, jobId }],
            // memo는 워크플로 콘솔에서 잡 단위 검색과 필터링에 쓰인다.
            memo: { jobId, kind, userId },
        });
        logInfo({ msg: "job.workflow.started", workflowId, taskQueue: JOB_TASK_QUEUE, jobId, kind });
    }

    /** 실행 중인 워크플로를 취소해 진행 중인 모델 호출까지 중단시킨다. */
    async cancel(kind: JobKind, jobId: string): Promise<WorkflowCancelOutcome> {
        const { client } = await this.connection();
        try {
            await client.workflow.getHandle(`${kind}:${jobId}`).cancel();
            return "canceled";
        } catch (error) {
            if (isWorkflowNotFound(error)) {
                logWarn({ msg: "job.workflow_cancel.absent", jobId, kind });
                return "absent";
            }
            throw error;
        }
    }

    async onModuleDestroy(): Promise<void> {
        if (this.handle === null) return;
        const handle = await this.handle.catch(() => null);
        if (handle !== null) await handle.connection.close().catch(() => undefined);
    }

    private connection(): Promise<TemporalHandle> {
        if (this.handle === null) {
            this.handle = createTemporalConnection().catch((error: unknown) => {
                this.handle = null;
                throw error;
            });
        }
        return this.handle;
    }
}
