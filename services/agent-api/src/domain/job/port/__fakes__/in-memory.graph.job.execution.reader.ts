import type { GraphJobExecution } from "~agent-api/domain/job/model/graph.job.execution.model.js";
import type {
    GraphJobExecutionHistoryPage,
    GraphJobExecutionHistoryQuery,
    GraphJobExecutionReaderPort,
} from "~agent-api/domain/job/port/graph.job.execution.reader.port.js";

/** 실행 원장 읽기 포트의 인메모리 대역이다. */
export class InMemoryGraphJobExecutionReader implements GraphJobExecutionReaderPort {
    private readonly rows = new Map<string, GraphJobExecution>();

    seed(...rows: readonly GraphJobExecution[]): void {
        for (const row of rows) this.rows.set(row.id, row);
    }

    findById(id: string): Promise<GraphJobExecution | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }

    findLatest(userId: string, kind: string, taskId?: string): Promise<GraphJobExecution | null> {
        const matches = [...this.rows.values()].filter(
            (row) => row.userId === userId && row.kind === kind && (taskId === undefined || row.taskId === taskId),
        );
        matches.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        return Promise.resolve(matches[0] ?? null);
    }

    findHistoryByUser(
        userId: string,
        query: GraphJobExecutionHistoryQuery,
    ): Promise<GraphJobExecutionHistoryPage> {
        const matches = [...this.rows.values()].filter(
            (row) =>
                row.userId === userId
                && (query.kind === undefined || row.kind === query.kind)
                && (query.status === undefined || row.status === query.status),
        );
        matches.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        return Promise.resolve({
            items: matches.slice(query.offset, query.offset + query.limit),
            total: matches.length,
        });
    }
}
