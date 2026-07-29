import type { JobKind } from "~agent-api/domain/job/model/job.const.js";
import type {
    WorkflowCancelOutcome,
    WorkflowDispatcherPort,
} from "~agent-api/domain/job/port/workflow.dispatcher.port.js";

/** 워크플로 디스패처 포트의 대역이며 무엇을 기동하고 무엇을 중단했는지만 적어 둔다. */
export class RecordingWorkflowDispatcher implements WorkflowDispatcherPort {
    readonly started: { readonly kind: JobKind; readonly jobId: string; readonly input: Record<string, unknown> }[] = [];
    readonly canceled: { readonly kind: JobKind; readonly jobId: string }[] = [];

    start(kind: JobKind, jobId: string, _userId: string, input: Record<string, unknown>): Promise<void> {
        this.started.push({ kind, jobId, input });
        return Promise.resolve();
    }

    cancel(kind: JobKind, jobId: string): Promise<WorkflowCancelOutcome> {
        this.canceled.push({ kind, jobId });
        return Promise.resolve("canceled");
    }
}
