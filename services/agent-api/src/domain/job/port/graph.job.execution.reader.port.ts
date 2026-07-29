import type { GraphJobExecution } from "~agent-api/domain/job/model/graph.job.execution.model.js";

export const GRAPH_JOB_EXECUTION_READER = Symbol("GraphJobExecutionReader");

export interface GraphJobExecutionHistoryQuery {
    readonly kind?: string;
    readonly status?: string;
    readonly limit: number;
    readonly offset: number;
}

export interface GraphJobExecutionHistoryPage {
    readonly items: readonly GraphJobExecution[];
    readonly total: number;
}

/** 자기 접수구에서 원장을 직접 쓰는 구현체의 실행을 읽기 전용으로 조회하는 포트다. */
export interface GraphJobExecutionReaderPort {
    findById(id: string): Promise<GraphJobExecution | null>;
    findLatest(userId: string, kind: string, taskId?: string): Promise<GraphJobExecution | null>;
    findHistoryByUser(userId: string, query: GraphJobExecutionHistoryQuery): Promise<GraphJobExecutionHistoryPage>;
}
