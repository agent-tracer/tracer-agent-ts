import type { DataSource } from "typeorm";
import { EventEntity, TaskEntity } from "~agent-worker/config/ledger/tracer.entity.js";
import type {
    CleanupEvent,
    CleanupEventReaderPort,
    CleanupTask,
    CleanupTaskReaderPort,
} from "~agent-worker/domain/cleanup/port/cleanup.reader.port.js";

/** 추적 원장의 태스크와 이벤트를 cleanup 도구 표현으로 읽는다. */
export class CleanupReaderAdapter implements CleanupTaskReaderPort, CleanupEventReaderPort {
    constructor(private readonly dataSource: DataSource) {}

    async findById(userId: string, taskId: string): Promise<CleanupTask | null> {
        const task = await this.dataSource.getRepository(TaskEntity).findOneBy({ userId, id: taskId });
        return task === null ? null : { id: task.id };
    }

    async findTimeline(
        userId: string,
        taskId: string,
        cursor: { readonly seq: string } | undefined,
        limit: number,
    ): Promise<readonly CleanupEvent[]> {
        const query = this.eventQuery(userId, taskId).orderBy("event.seq", "ASC").limit(limit);
        if (cursor !== undefined) query.andWhere("event.seq > :cursor", { cursor: cursor.seq });
        return (await query.getMany()).map(toEvent);
    }

    async findTimelineWindow(
        userId: string,
        taskId: string,
        cursor: string | undefined,
        limit: number,
    ): Promise<readonly CleanupEvent[]> {
        const query = this.eventQuery(userId, taskId).orderBy("event.seq", "DESC").limit(limit);
        if (cursor !== undefined) query.andWhere("event.seq < :cursor", { cursor });
        return (await query.getMany()).map(toEvent);
    }

    countByTask(userId: string, taskId: string): Promise<number> {
        return this.dataSource.getRepository(EventEntity).count({ where: { userId, taskId } });
    }

    private eventQuery(userId: string, taskId: string) {
        return this.dataSource
            .getRepository(EventEntity)
            .createQueryBuilder("event")
            .where("event.user_id = :userId AND event.task_id = :taskId", { userId, taskId });
    }
}

function toEvent(event: EventEntity): CleanupEvent {
    return {
        id: event.id,
        seq: event.seq,
        kind: event.kind,
        title: event.title,
        body: event.body,
        toolName: event.toolName,
        filePaths: event.filePaths,
        occurredAt: event.occurredAt,
    };
}
