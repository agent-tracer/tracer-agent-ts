import type { Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatExecutionSnapshot } from "~agent-api/domain/chat/application/query/watch.chat.execution.usecase.js";
import { streamChatExecution } from "./chat.execution.stream.js";

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
});
