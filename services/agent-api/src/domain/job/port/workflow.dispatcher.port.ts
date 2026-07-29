import type { JobKind } from "~agent-api/domain/job/model/job.const.js";

export const WORKFLOW_DISPATCHER = Symbol("WorkflowDispatcher");

/** 취소 요청이 받아들여졌는지, 취소할 워크플로가 이미 없었는지를 가른다. */
export type WorkflowCancelOutcome = "canceled" | "absent";

/** 잡 워크플로의 시작과 취소를 제공하며 취소는 워크플로 엔진에 닿지 못하면 예외를 던진다. */
export interface WorkflowDispatcherPort {
    start(kind: JobKind, jobId: string, userId: string, input: Record<string, unknown>): Promise<void>;
    cancel(kind: JobKind, jobId: string): Promise<WorkflowCancelOutcome>;
}
