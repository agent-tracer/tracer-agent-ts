import { HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import type {
    ChatExecutionSnapshot,
    WatchChatExecutionUseCase,
} from "~agent-api/domain/chat/application/query/watch.chat.execution.usecase.js";
import { SseWriter } from "./chat.sse.writer.js";

// 깨움이 유실돼도 이 주기 조회가 정본을 다시 읽어 오므로 버스는 지연만 줄이면 된다.
const HEARTBEAT_MS = 20_000;

export interface ChatExecutionStreamTarget {
    readonly userId: string;
    readonly threadId: string;
    readonly executionId: string;
}

/** 실행 스냅샷을 열린 연결에 흘려보내고 종결되면 연결을 닫는다. */
export async function streamChatExecution(
    watch: WatchChatExecutionUseCase,
    response: Response,
    target: ChatExecutionStreamTarget,
): Promise<void> {
    await watch.snapshot(target.userId, target.threadId, target.executionId);
    response.status(HttpStatus.OK);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();

    const writer = new SseWriter(response);
    let closed = false;
    let refreshTail = Promise.resolve();
    let unsubscribe = (): void => undefined;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    const close = (): void => {
        if (closed) return;
        closed = true;
        if (heartbeat !== null) clearInterval(heartbeat);
        unsubscribe();
        writer.close();
    };
    const send = async (snapshot: ChatExecutionSnapshot): Promise<void> => {
        if (closed) return;
        await writer.write("snapshot", snapshot, executionEventId(snapshot.execution));
        if (isTerminalExecution(snapshot.execution.status)) response.end();
    };
    const refresh = (): void => {
        refreshTail = refreshTail.then(async () => {
            await send(await watch.snapshot(target.userId, target.threadId, target.executionId));
        }).catch(() => close());
    };
    unsubscribe = watch.subscribe(target.executionId, refresh);
    heartbeat = setInterval(() => {
        if (!closed) refresh();
    }, HEARTBEAT_MS);
    response.once("close", close);
    refresh();
    await refreshTail;
}

function executionEventId(execution: { readonly draftSeq: number; readonly updatedAt: string }): string {
    return `${execution.draftSeq}:${execution.updatedAt}`;
}

function isTerminalExecution(status: string): boolean {
    return status === "completed" || status === "failed" || status === "canceled";
}
