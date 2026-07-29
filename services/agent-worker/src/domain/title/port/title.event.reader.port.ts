import type { TitleSlimEvent } from "~agent-worker/domain/title/model/title.event.model.js";

/** 이벤트 한 쪽을 읽는 요청이며 커서는 앞선 쪽이 낸 seq다. */
export interface TitleTimelineQuery {
    readonly userId: string;
    readonly taskId: string;
    readonly limit: number;
    /** 참이면 최신 이벤트부터 거슬러 읽는다. */
    readonly descending: boolean;
    readonly cursor?: string;
}

/** 제목 제안 도구가 근거로 읽는 태스크 이벤트 창구다. */
export interface TitleEventReaderPort {
    taskExists(userId: string, taskId: string): Promise<boolean>;
    readTimeline(query: TitleTimelineQuery): Promise<readonly TitleSlimEvent[]>;
    countByTask(userId: string, taskId: string): Promise<number>;
}
