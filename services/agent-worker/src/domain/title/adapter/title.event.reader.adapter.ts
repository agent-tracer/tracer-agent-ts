import type { DataSource } from "typeorm";
import { EventEntity, TaskEntity } from "~agent-worker/config/ledger/tracer.entity.js";
import type { TitleSlimEvent } from "~agent-worker/domain/title/model/title.event.model.js";
import type {
    TitleEventReaderPort,
    TitleTimelineQuery,
} from "~agent-worker/domain/title/port/title.event.reader.port.js";

/** 추적 서비스가 소유하는 이벤트 표를 근거로 읽는 창구다. */
export class TitleEventReaderAdapter implements TitleEventReaderPort {
    constructor(private readonly dataSource: DataSource) {}

    async taskExists(userId: string, taskId: string): Promise<boolean> {
        const found = await this.dataSource
            .getRepository(TaskEntity)
            .findOne({ where: { userId, id: taskId }, select: { id: true } });
        return found !== null;
    }

    async readTimeline(query: TitleTimelineQuery): Promise<readonly TitleSlimEvent[]> {
        const builder = this.dataSource
            .getRepository(EventEntity)
            .createQueryBuilder("event")
            .where("event.user_id = :userId AND event.task_id = :taskId", {
                userId: query.userId,
                taskId: query.taskId,
            })
            .orderBy("event.seq", query.descending ? "DESC" : "ASC")
            .limit(query.limit);
        if (query.cursor !== undefined) {
            builder.andWhere(query.descending ? "event.seq < :cursor" : "event.seq > :cursor", {
                cursor: query.cursor,
            });
        }
        return (await builder.getMany()).map(toSlimEvent);
    }

    async countByTask(userId: string, taskId: string): Promise<number> {
        return this.dataSource.getRepository(EventEntity).count({ where: { userId, taskId } });
    }
}

function toSlimEvent(event: EventEntity): TitleSlimEvent {
    return {
        id: event.id,
        seq: event.seq,
        kind: event.kind,
        title: event.title,
        ...(event.body !== null ? { body: event.body } : {}),
        ...(event.toolName !== null ? { toolName: event.toolName } : {}),
        filePaths: event.filePaths,
        occurredAt: event.occurredAt.toISOString(),
    };
}
