import { describe, expect, it } from "vitest";
import { TracerApiError } from "./tracer.api.error.js";
import { TracerApiWindow, type HttpRequestInit } from "./tracer.api.window.js";

interface Sent {
    url: string;
    init: HttpRequestInit;
}

function windowWith(status: number, body: unknown): { target: TracerApiWindow; sent: Sent[] } {
    const sent: Sent[] = [];
    const target = new TracerApiWindow("http://tracer-api:3902/", (url, init) => {
        sent.push({ url, init });
        return Promise.resolve({ status, text: () => Promise.resolve(JSON.stringify(body)) });
    });
    return { target, sent };
}

describe("TracerApiWindow", () => {
    it("값이 있는 쿼리만 물음표 뒤에 싣는다", async () => {
        const { target, sent } = windowWith(200, { ok: true, data: { items: [] } });

        await target.request({
            method: "GET",
            path: "/api/v1/tasks/t1/timeline",
            userId: "local",
            query: { order: "asc", limit: 30, cursor: undefined },
        });

        expect(sent[0]!.url).toBe("http://tracer-api:3902/api/v1/tasks/t1/timeline?order=asc&limit=30");
        expect(sent[0]!.init.headers["x-monitor-user"]).toBe("local");
    });

    it("본문을 실을 때만 내용 유형을 붙인다", async () => {
        const { target, sent } = windowWith(201, { ok: true, data: { recipes: [] } });

        await target.request({
            method: "POST",
            path: "/api/v1/recipes",
            userId: "local",
            body: { recipes: [], author: "agent" },
        });

        expect(sent[0]!.init.headers["content-type"]).toBe("application/json");
        expect(sent[0]!.init.body).toBe(`{"recipes":[],"author":"agent"}`);
    });

    it("성공 봉투를 벗겨 본문만 낸다", async () => {
        const { target } = windowWith(200, { ok: true, data: { items: [1] } });

        await expect(target.request({ method: "GET", path: "/api/v1/tasks", userId: "local" }))
            .resolves.toEqual({ items: [1] });
    });

    it("남의 것을 물으면 비어 있음을 낸다", async () => {
        const { target } = windowWith(404, { ok: false, error: { code: "not_found", message: "Task not found" } });

        await expect(target.requestOrNull({ method: "GET", path: "/api/v1/tasks/t1", userId: "local" }))
            .resolves.toBeNull();
    });

    it("없음이 아닌 거절은 그대로 올린다", async () => {
        const { target } = windowWith(500, "gateway exploded");

        await expect(target.requestOrNull({ method: "GET", path: "/api/v1/tasks/t1", userId: "local" }))
            .rejects.toBeInstanceOf(TracerApiError);
    });
});
