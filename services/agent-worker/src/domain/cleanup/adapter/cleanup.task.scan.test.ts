import { TracerApiWindow } from "@tracer-agent/tracer-client";
import { describe, expect, it } from "vitest";
import { loadCleanupScanBatch } from "./cleanup.task.scan.js";

function task(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: "t1",
        userId: "local",
        title: "제목",
        slug: "t1",
        status: "completed",
        taskKind: "coding",
        origin: "claude-code",
        archived: false,
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z",
        lastEventAt: "2026-07-02T00:00:00.000Z",
        ...overrides,
    };
}

function windowWith(pages: Readonly<Record<string, unknown>>): { tracer: TracerApiWindow; urls: string[] } {
    const urls: string[] = [];
    const tracer = new TracerApiWindow("http://tracer-api:3902", (url) => {
        urls.push(url);
        const key = new URL(url).searchParams.get("status") ?? "visible";
        const payload = pages[key] ?? { items: [], total: 0, nextCursor: null };
        return Promise.resolve({
            status: 200,
            text: () => Promise.resolve(JSON.stringify({ ok: true, data: payload })),
        });
    });
    return { tracer, urls };
}

describe("정리 스캔 배치", () => {
    it("보관하지 않은 태스크만 목록 창구에 요구한다", async () => {
        const { tracer, urls } = windowWith({
            visible: { items: [task()], total: 1, nextCursor: null },
        });

        await loadCleanupScanBatch(tracer, "local");

        expect(urls[0]).toContain("archived=false");
        expect(urls.some((url) => url.includes("status=running"))).toBe(true);
        expect(urls.some((url) => url.includes("status=waiting"))).toBe(true);
    });

    it("서버 에이전트가 만든 태스크를 정리 대상에서 뺀다", async () => {
        const { tracer } = windowWith({
            visible: {
                items: [task(), task({ id: "t2", origin: "server-sdk" })],
                total: 2,
                nextCursor: null,
            },
        });

        const batch = await loadCleanupScanBatch(tracer, "local");

        expect(batch.tasks.map((entry) => entry.id)).toEqual(["t1"]);
        expect(batch.tasksScanned).toBe(1);
        expect(batch.truncated).toBe(false);
    });

    it("살아 있는 자식의 부모만 후보 판정에 넘긴다", async () => {
        const { tracer } = windowWith({
            visible: { items: [task()], total: 1, nextCursor: null },
            running: {
                items: [task({ id: "t9", status: "running", parentTaskId: "t1" }), task({ id: "t8", status: "running" })],
                total: 2,
                nextCursor: null,
            },
        });

        const batch = await loadCleanupScanBatch(tracer, "local");

        expect(batch.activeChildParentIds).toEqual(["t1"]);
    });

    it("후보를 시각까지 담은 순수 표현으로 옮긴다", async () => {
        const { tracer } = windowWith({
            visible: { items: [task({ lastEventAt: undefined })], total: 1, nextCursor: null },
        });

        const batch = await loadCleanupScanBatch(tracer, "local");

        expect(batch.tasks[0]).toEqual({
            id: "t1",
            title: "제목",
            status: "completed",
            lastEventAt: null,
            updatedAt: "2026-07-02T00:00:00.000Z",
        });
    });
});
