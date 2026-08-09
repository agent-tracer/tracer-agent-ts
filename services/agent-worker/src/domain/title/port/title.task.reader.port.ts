import type { TitleContext } from "~agent-worker/domain/title/model/title.context.model.js";

/** 제목 제안이 보는 태스크의 대화 컨텍스트다. */
export interface TitleTaskContext {
    readonly totalEventCount: number;
    readonly context: TitleContext | null;
}

/** 추적 API의 공개 경로로만 태스크를 보는 포트이며 원장이 아니므로 연결을 쥐지 않는다. */
export interface TitleTaskReaderPort {
    findTaskContext(userId: string, taskId: string): Promise<TitleTaskContext | null>;
}
