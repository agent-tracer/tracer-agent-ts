import type { Repository } from "typeorm";
import type { GraphJobExecution } from "~agent-api/domain/job/model/graph.job.execution.model.js";
import type {
    GraphJobExecutionHistoryPage,
    GraphJobExecutionHistoryQuery,
    GraphJobExecutionReaderPort,
} from "~agent-api/domain/job/port/graph.job.execution.reader.port.js";
import { toGraphJobExecution, type GraphJobExecutionEntity } from "./graph.job.execution.entity.js";

export class TypeOrmGraphJobExecutionReader implements GraphJobExecutionReaderPort {
    constructor(private readonly repo: Repository<GraphJobExecutionEntity>) {}

    async findById(id: string): Promise<GraphJobExecution | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row === null ? null : toGraphJobExecution(row);
    }

    async findLatest(userId: string, kind: string, taskId?: string): Promise<GraphJobExecution | null> {
        const row = await this.repo.findOne({
            where: { userId, kind, ...(taskId !== undefined ? { taskId } : {}) },
            order: { createdAt: "DESC" },
        });
        return row === null ? null : toGraphJobExecution(row);
    }

    async findHistoryByUser(
        userId: string,
        query: GraphJobExecutionHistoryQuery,
    ): Promise<GraphJobExecutionHistoryPage> {
        const [rows, total] = await this.repo.findAndCount({
            where: {
                userId,
                ...(query.kind !== undefined ? { kind: query.kind } : {}),
                ...(query.status !== undefined ? { status: query.status } : {}),
            },
            order: { createdAt: "DESC" },
            take: query.limit,
            skip: query.offset,
        });
        return { items: rows.map(toGraphJobExecution), total };
    }
}
