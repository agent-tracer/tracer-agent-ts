import type { Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatExecutionSnapshot } from "~agent-api/domain/chat/application/query/watch.chat.execution.usecase.js";
import { readChatExecutionStreamRules } from "~agent-api/support/contract.js";
import { streamChatExecution } from "./chat.execution.stream.js";

const RULES = readChatExecutionStreamRules();

const TARGET = { userId: "alice", threadId: "thread-1", executionId: "execution-1" } as const;

class FakeResponse {
    readonly headers = new Map<string, string>();
    readonly chunks: string[] = [];
    ended = false;
    req: unknown;
    private readonly listeners = new Map<string, () => void>();

    status(): this {
        return this;
    }

    setHeader(name: string, value: string): void {
        this.headers.set(name, value);
    }

    flushHeaders(): void {}

    write(chunk: string): boolean {
        this.chunks.push(chunk);
        return true;
    }

    end(): void {
        this.ended = true;
    }

    once(event: string, listener: () => void): this {
        this.listeners.set(event, listener);
        return this;
    }

    off(): this {
        return this;
    }

    emit(event: string): void {
        this.listeners.get(event)?.();
    }
}

function snapshotOf(status: string, draftSeq: number): ChatExecutionSnapshot {
    return {
        execution: { id: TARGET.executionId, status, draftSeq, updatedAt: "2026-01-01T00:00:00.000Z" },
        confirmations: [],
    } as unknown as ChatExecutionSnapshot;
}

function watchOf(...snapshots: readonly ChatExecutionSnapshot[]) {
    const queue = [...snapshots];
    return {
        snapshot: vi.fn(async () => queue.length > 1 ? queue.shift()! : queue[0]!),
        subscribe: vi.fn(() => () => undefined),
    };
}

describe("streamChatExecution", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("event 와 data 두 줄만 실은 프레임을 낸다", async () => {
        const response = new FakeResponse();
        const snapshot = snapshotOf("running", 3);

        await streamChatExecution(watchOf(snapshot) as never, response as unknown as Response, TARGET);
        response.emit("close");

        expect(response.chunks).toHaveLength(1);
        expect(response.chunks[0]).toBe(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
        expect(response.chunks[0]!.split("\n").filter((line) => line.length > 0)).toEqual([
            "event: snapshot",
            `data: ${JSON.stringify(snapshot)}`,
        ]);
    });

    it("종결 상태를 실은 프레임 뒤에 연결을 닫는다", async () => {
        const response = new FakeResponse();

        await streamChatExecution(watchOf(snapshotOf("completed", 7)) as never, response as unknown as Response, TARGET);
        response.emit("close");

        expect(response.chunks).toHaveLength(1);
        expect(response.ended).toBe(true);
    });

    it("재접속이 실어 보낸 Last-Event-ID 를 읽지 않고 그 순간의 정본을 낸다", async () => {
        const response = new FakeResponse();
        const readHeaders: string[] = [];
        response.req = {
            headers: new Proxy(
                { "last-event-id": "1:2025-12-31T00:00:00.000Z" },
                {
                    get(target, key) {
                        readHeaders.push(String(key));
                        return Reflect.get(target, key) as string | undefined;
                    },
                },
            ),
        };
        const current = snapshotOf("running", 9);

        await streamChatExecution(watchOf(current) as never, response as unknown as Response, TARGET);
        response.emit("close");

        expect(RULES.replay.mode).toBe("none");
        expect(readHeaders).toEqual([]);
        expect(response.chunks[0]).toBe(`event: snapshot\ndata: ${JSON.stringify(current)}\n\n`);
    });

    it("계약이 정한 머리를 응답에 싣는다", async () => {
        const response = new FakeResponse();

        await streamChatExecution(watchOf(snapshotOf("running", 1)) as never, response as unknown as Response, TARGET);
        response.emit("close");

        expect(Object.fromEntries(response.headers)).toMatchObject(RULES.headers);
    });

    it("계약이 정한 주기마다 정본을 다시 낸다", async () => {
        const response = new FakeResponse();
        const watch = watchOf(snapshotOf("running", 1), snapshotOf("running", 2));

        await streamChatExecution(watch as never, response as unknown as Response, TARGET);
        await vi.advanceTimersByTimeAsync(RULES.resendIntervalMs - 1);
        expect(response.chunks).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(1);
        response.emit("close");

        expect(response.chunks).toHaveLength(2);
    });

    it("정본이 그대로여도 주기 재전송은 내보내 게이트웨이가 조용한 스트림을 끊지 않게 한다", async () => {
        const response = new FakeResponse();
        const watch = watchOf(snapshotOf("running", 1));

        await streamChatExecution(watch as never, response as unknown as Response, TARGET);
        await vi.advanceTimersByTimeAsync(RULES.resendIntervalMs);
        response.emit("close");

        expect(response.chunks).toHaveLength(2);
    });

    it("신호가 와도 정본이 그대로면 프레임을 내지 않는다", async () => {
        const response = new FakeResponse();
        const watch = signalableWatch(snapshotOf("running", 1));

        await streamChatExecution(watch as never, response as unknown as Response, TARGET);
        await watch.signal();
        response.emit("close");

        expect(response.chunks).toHaveLength(1);
    });

    it("신호가 몰려도 조회를 쌓지 않고 한 번에 접는다", async () => {
        const response = new FakeResponse();
        const watch = signalableWatch(snapshotOf("running", 1));
        const openingQueries = watch.snapshot.mock.calls.length;

        await streamChatExecution(watch as never, response as unknown as Response, TARGET);
        const afterOpen = watch.snapshot.mock.calls.length;
        await watch.signal(5);
        response.emit("close");

        expect(openingQueries).toBe(0);
        expect(watch.snapshot.mock.calls.length - afterOpen).toBeLessThan(5);
    });
});

/** 구독자를 붙잡아 두어 버스 신호를 흉내 낼 수 있는 조회다. */
function signalableWatch(current: ChatExecutionSnapshot) {
    let notify: () => void = () => undefined;
    const snapshot = vi.fn(async () => current);
    return {
        snapshot,
        subscribe: vi.fn((_executionId: string, listener: () => void) => {
            notify = listener;
            return () => undefined;
        }),
        async signal(times = 1): Promise<void> {
            for (let index = 0; index < times; index += 1) notify();
            await vi.advanceTimersByTimeAsync(0);
        },
    };
}
