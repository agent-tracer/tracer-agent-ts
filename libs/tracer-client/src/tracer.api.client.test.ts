import { describe, expect, it } from "vitest";
import { TracerApiClient, type HttpRequestInit } from "./tracer.api.client.js";
import { TracerApiError } from "./tracer.api.error.js";

interface Sent {
    url: string;
    init: HttpRequestInit;
}

function clientWith(status: number, body: unknown): { client: TracerApiClient; sent: Sent[] } {
    const sent: Sent[] = [];
    const client = new TracerApiClient("http://tracer-api:3902/", (url, init) => {
        sent.push({ url, init });
        return Promise.resolve({ status, text: () => Promise.resolve(JSON.stringify(body)) });
    });
    return { client, sent };
}

describe("TracerApiClient", () => {
    it("계약이 선언한 방법과 경로로 부른다", async () => {
        const { client, sent } = clientWith(200, { ok: true, data: { reevaluated: 3 } });

        const data = await client.call({ toolName: "approve_rule", userId: "local", args: { ruleId: "r1" } });

        expect(sent[0]!.url).toBe("http://tracer-api:3902/api/v1/rules/r1/approve");
        expect(sent[0]!.init.method).toBe("POST");
        expect(data).toEqual({ reevaluated: 3 });
    });

    it("자기신고 사용자 헤더를 실어 보낸다", async () => {
        const { client, sent } = clientWith(200, { ok: true, data: null });

        await client.call({ toolName: "list_tags", userId: "someone", args: {} });

        expect(sent[0]!.init.headers["x-monitor-user"]).toBe("someone");
    });

    it("실행 범위 자격이 있으면 베어러로 함께 보낸다", async () => {
        const { client, sent } = clientWith(200, { ok: true, data: null });

        await client.call({ toolName: "list_tags", userId: "local", args: {}, scopeToken: "ms1.x.y" });

        expect(sent[0]!.init.headers["authorization"]).toBe("Bearer ms1.x.y");
    });

    it("쿼리 인자를 물음표 뒤에 싣는다", async () => {
        const { client, sent } = clientWith(200, { ok: true, data: { items: [] } });

        await client.call({ toolName: "search_tasks", userId: "local", args: { status: "running" } });

        expect(sent[0]!.url).toBe("http://tracer-api:3902/api/v1/tasks?status=running");
    });

    it("성공 봉투를 벗겨 본문만 낸다", async () => {
        const { client } = clientWith(200, { ok: true, data: { items: [1] } });

        await expect(client.call({ toolName: "list_tags", userId: "local", args: {} }))
            .resolves.toEqual({ items: [1] });
    });

    it("거절이 오면 그 코드와 상태를 그대로 옮긴다", async () => {
        const { client } = clientWith(404, { ok: false, error: { code: "not_found", message: "Task not found" } });

        await expect(client.call({ toolName: "get_task", userId: "local", args: { taskId: "t1" } }))
            .rejects.toMatchObject({ httpStatus: 404, code: "not_found", message: "Task not found" });
    });

    it("봉투가 아닌 실패는 상류 실패로 분류한다", async () => {
        const { client } = clientWith(500, "gateway exploded");

        await expect(client.call({ toolName: "list_tags", userId: "local", args: {} }))
            .rejects.toBeInstanceOf(TracerApiError);
    });
});
