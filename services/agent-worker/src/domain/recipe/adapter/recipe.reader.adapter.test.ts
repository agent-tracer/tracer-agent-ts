import { TracerApiWindow, type HttpRequestInit } from "@tracer-agent/tracer-client";
import { describe, expect, it } from "vitest";
import { RecipeReaderAdapter } from "./recipe.reader.adapter.js";

interface Sent {
    readonly url: string;
    readonly init: HttpRequestInit;
}

function windowWith(payloads: readonly unknown[]): { tracer: TracerApiWindow; sent: Sent[] } {
    const sent: Sent[] = [];
    let position = 0;
    const tracer = new TracerApiWindow("http://tracer-api:3902", (url, init) => {
        sent.push({ url, init });
        const payload = payloads[Math.min(position, payloads.length - 1)];
        position += 1;
        return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify(payload)) });
    });
    return { tracer, sent };
}

function timelineItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: "evt-1",
        seq: "12",
        turnId: "turn-1",
        kind: "agent_tracer.user.message",
        lane: "user",
        title: "고쳐 달라",
        body: "본문",
        toolName: "Bash",
        filePaths: ["src/a.ts"],
        metadata: { note: 1 },
        occurredAt: "2026-07-14T00:00:00.000Z",
        ...overrides,
    };
}

describe("RecipeReaderAdapter", () => {
    it("태스크 상세 창구가 낸 칸을 도구 표현으로 옮긴다", async () => {
        const { tracer, sent } = windowWith([
            { ok: true, data: { task: { id: "t1", title: "제목", status: "completed", taskKind: "coding", workspacePath: null, createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-02T00:00:00.000Z" } } },
        ]);

        const task = await new RecipeReaderAdapter(tracer).findById("local", "t1");

        expect(sent[0]!.url).toBe("http://tracer-api:3902/api/v1/tasks/t1");
        expect(task).toEqual({
            id: "t1",
            title: "제목",
            status: "completed",
            taskKind: "coding",
            workspacePath: null,
            createdAt: new Date("2026-07-01T00:00:00.000Z"),
            updatedAt: new Date("2026-07-02T00:00:00.000Z"),
        });
    });

    it("남의 태스크를 물으면 비어 있음을 낸다", async () => {
        const sent: Sent[] = [];
        const tracer = new TracerApiWindow("http://tracer-api:3902", (url, init) => {
            sent.push({ url, init });
            return Promise.resolve({
                status: 404,
                text: () => Promise.resolve(`{"ok":false,"error":{"code":"not_found","message":"Task not found"}}`),
            });
        });

        await expect(new RecipeReaderAdapter(tracer).findById("local", "t1")).resolves.toBeNull();
    });

    it("이른 이벤트부터 읽을 때 오름차순을 요구한다", async () => {
        const { tracer, sent } = windowWith([{ ok: true, data: { items: [timelineItem()], total: 1 } }]);

        const events = await new RecipeReaderAdapter(tracer).findTimeline("local", "t1", { seq: "9" }, 30);

        expect(sent[0]!.url).toBe("http://tracer-api:3902/api/v1/tasks/t1/timeline?order=asc&limit=30&cursor=9");
        expect(events[0]).toMatchObject({ id: "evt-1", seq: "12", turnId: "turn-1", metadata: { note: 1 } });
    });

    it("늦은 이벤트부터 읽을 때 내림차순을 요구한다", async () => {
        const { tracer, sent } = windowWith([{ ok: true, data: { items: [], total: 0 } }]);

        await new RecipeReaderAdapter(tracer).findTimelineWindow("local", "t1", undefined, 5);

        expect(sent[0]!.url).toBe("http://tracer-api:3902/api/v1/tasks/t1/timeline?order=desc&limit=5");
    });

    it("이벤트 총수를 타임라인 응답의 전체 개수에서 읽는다", async () => {
        const { tracer } = windowWith([{ ok: true, data: { items: [timelineItem()], total: 41 } }]);

        await expect(new RecipeReaderAdapter(tracer).countByTask("local", "t1")).resolves.toBe(41);
    });

    it("규칙 창구가 낸 기대를 종류별 표현으로 옮긴다", async () => {
        const { tracer, sent } = windowWith([
            {
                ok: true,
                data: {
                    items: [
                        {
                            id: "r1",
                            name: "빌드를 돌린다",
                            expectation: { kind: "command", commandMatches: ["npm run build"] },
                            taskId: "t1",
                            anchorEventId: "evt-1",
                            source: "agent",
                            severity: "must",
                            rationale: null,
                            signature: "sig",
                            createdAt: "2026-07-01T00:00:00.000Z",
                        },
                    ],
                },
            },
        ]);

        const rules = await new RecipeReaderAdapter(tracer).findApplicable("local", "t1");

        expect(sent[0]!.url).toBe("http://tracer-api:3902/api/v1/rules?taskId=t1");
        expect(rules[0]).toMatchObject({
            id: "r1",
            expectation: { kind: "command", commandMatches: ["npm run build"] },
            anchorEventId: "evt-1",
        });
    });
});
