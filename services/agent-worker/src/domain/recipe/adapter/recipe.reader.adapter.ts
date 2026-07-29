import type { DataSource } from "typeorm";
import { EventEntity, TaskEntity } from "~agent-worker/config/ledger/tracer.entity.js";
import type {
    RecipeEvent,
    RecipeEventReaderPort,
    RecipeRule,
    RecipeRuleReaderPort,
    RecipeTask,
    RecipeTaskReaderPort,
} from "~agent-worker/domain/recipe/port/recipe.reader.port.js";

/** 추적 원장의 태스크와 이벤트와 규칙을 레시피 도구 표현으로 읽는다. */
export class RecipeReaderAdapter
    implements RecipeTaskReaderPort, RecipeEventReaderPort, RecipeRuleReaderPort
{
    constructor(private readonly dataSource: DataSource) {}

    async findById(userId: string, taskId: string): Promise<RecipeTask | null> {
        const task = await this.dataSource.getRepository(TaskEntity).findOneBy({ userId, id: taskId });
        return task === null ? null : toTask(task);
    }

    async findTimeline(
        userId: string,
        taskId: string,
        cursor: { readonly seq: string } | undefined,
        limit: number,
    ): Promise<readonly RecipeEvent[]> {
        const query = this.eventQuery(userId, taskId).orderBy("event.seq", "ASC").limit(limit);
        if (cursor !== undefined) query.andWhere("event.seq > :cursor", { cursor: cursor.seq });
        return (await query.getMany()).map(toEvent);
    }

    async findTimelineWindow(
        userId: string,
        taskId: string,
        cursor: string | undefined,
        limit: number,
    ): Promise<readonly RecipeEvent[]> {
        const query = this.eventQuery(userId, taskId).orderBy("event.seq", "DESC").limit(limit);
        if (cursor !== undefined) query.andWhere("event.seq < :cursor", { cursor });
        return (await query.getMany()).map(toEvent);
    }

    countByTask(userId: string, taskId: string): Promise<number> {
        return this.dataSource.getRepository(EventEntity).count({ where: { userId, taskId } });
    }

    async findApplicable(userId: string, taskId: string): Promise<readonly RecipeRule[]> {
        const rows = await this.dataSource.query<RecipeRuleRow[]>(
            `SELECT id, name, expectation, task_id, anchor_event_id, source, severity,
                    rationale, signature, created_at
               FROM rules
              WHERE user_id = $1 AND task_id = $2`,
            [userId, taskId],
        );
        return rows.map(toRule);
    }

    private eventQuery(userId: string, taskId: string) {
        return this.dataSource
            .getRepository(EventEntity)
            .createQueryBuilder("event")
            .where("event.user_id = :userId AND event.task_id = :taskId", { userId, taskId });
    }
}

interface RecipeRuleRow {
    readonly id: string;
    readonly name: string;
    readonly expectation: RecipeRule["expectation"];
    readonly task_id: string;
    readonly anchor_event_id: string;
    readonly source: string;
    readonly severity: string;
    readonly rationale: string | null;
    readonly signature: string;
    readonly created_at: Date;
}

function toTask(task: TaskEntity): RecipeTask {
    return {
        id: task.id,
        title: task.title,
        status: task.status,
        taskKind: task.taskKind,
        workspacePath: task.workspacePath,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
    };
}

function toEvent(event: EventEntity): RecipeEvent {
    return {
        id: event.id,
        seq: event.seq,
        turnId: event.turnId,
        kind: event.kind,
        title: event.title,
        body: event.body,
        toolName: event.toolName,
        filePaths: event.filePaths,
        metadata: event.metadata,
        occurredAt: event.occurredAt,
    };
}

function toRule(row: RecipeRuleRow): RecipeRule {
    return {
        id: row.id,
        name: row.name,
        expectation: row.expectation,
        taskId: row.task_id,
        anchorEventId: row.anchor_event_id,
        source: row.source,
        severity: row.severity,
        rationale: row.rationale,
        signature: row.signature,
        createdAt: row.created_at,
    };
}
