import { HttpStatus } from "@nestjs/common";
import { errorMessage, logWarn } from "@tracer-agent/platform";
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
    let refreshQueued = false;
    let forceNextFrame = false;
    let lastFrame: string | null = null;
    let unsubscribe = (): void => undefined;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    const close = (): void => {
        if (closed) return;
        closed = true;
        if (heartbeat !== null) clearInterval(heartbeat);
        unsubscribe();
        writer.close();
    };
    const send = async (snapshot: ChatExecutionSnapshot, keepalive: boolean): Promise<void> => {
        if (closed) return;
        const terminal = isTerminalExecution(snapshot.execution.status);
        const frame = JSON.stringify(snapshot);
        // 정본이 그대로면 화면도 그대로이나, 주기 재전송은 게이트웨이 유휴 타임아웃을 막으므로 거르지 않는다.
        if (frame === lastFrame && !terminal && !keepalive) return;
        lastFrame = frame;
        await writer.write("snapshot", snapshot);
        if (terminal) response.end();
    };
    // 이미 기다리는 조회가 있으면 그 조회가 최신 정본을 읽으므로 신호마다 질의를 쌓지 않는다.
    const refresh = (keepalive = false): void => {
        forceNextFrame ||= keepalive;
        if (refreshQueued) return;
        refreshQueued = true;
        refreshTail = refreshTail.then(async () => {
            refreshQueued = false;
            const forced = forceNextFrame;
            forceNextFrame = false;
            await send(await watch.snapshot(target.userId, target.threadId, target.executionId), forced);
        }).catch((error: unknown) => {
            // 헤더가 이미 나간 뒤라 상태를 바꿀 수 없으므로 이 실패는 관측에만 남고 클라이언트에는 끊긴 스트림으로 보인다.
            logWarn({ msg: "chat.stream.failed", executionId: target.executionId, error: errorMessage(error) });
            close();
        });
    };
    unsubscribe = watch.subscribe(target.executionId, () => refresh());
    // 신호가 유실돼도 이 주기 조회가 정본을 다시 읽어 오므로 버스는 지연만 줄이면 된다.
    heartbeat = setInterval(() => {
        if (!closed) refresh(true);
    }, STREAM_RULES.resendIntervalMs);
    response.once("close", close);
    refresh(true);
    await refreshTail;
}

function isTerminalExecution(status: string): boolean {
    return status === "completed" || status === "failed" || status === "canceled";
}
