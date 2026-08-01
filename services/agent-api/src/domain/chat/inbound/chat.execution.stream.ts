import { HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import type {
    ChatExecutionSnapshot,
    WatchChatExecutionUseCase,
} from "~agent-api/domain/chat/application/query/watch.chat.execution.usecase.js";
import { readChatExecutionStreamRules } from "~agent-api/support/contract.js";
import { SseWriter } from "./chat.sse.writer.js";

const STREAM_RULES = readChatExecutionStreamRules();

export interface ChatExecutionStreamTarget {
    readonly userId: string;
    readonly threadId: string;
    readonly executionId: string;
}

/** 재접속이 실어 보낸 Last-Event-ID 를 읽지 않고 그 순간의 정본부터 이어서 내보내며 종결되면 연결을 닫는다. */
export async function streamChatExecution(
    watch: WatchChatExecutionUseCase,
    response: Response,
    target: ChatExecutionStreamTarget,
): Promise<void> {
    await watch.snapshot(target.userId, target.threadId, target.executionId);
    response.status(HttpStatus.OK);
    response.setHeader("Content-Type", "text/event-stream");
    for (const [name, value] of Object.entries(STREAM_RULES.headers)) response.setHeader(name, value);
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
        await writer.write("snapshot", snapshot);
        if (isTerminalExecution(snapshot.execution.status)) response.end();
    };
    const refresh = (): void => {
        refreshTail = refreshTail.then(async () => {
            await send(await watch.snapshot(target.userId, target.threadId, target.executionId));
        }).catch(() => close());
    };
    unsubscribe = watch.subscribe(target.executionId, refresh);
    // 깨움이 유실돼도 이 주기 조회가 정본을 다시 읽어 오므로 버스는 지연만 줄이면 된다.
    heartbeat = setInterval(() => {
        if (!closed) refresh();
    }, STREAM_RULES.resendIntervalMs);
    response.once("close", close);
    refresh();
    await refreshTail;
}

function isTerminalExecution(status: string): boolean {
    return status === "completed" || status === "failed" || status === "canceled";
}
