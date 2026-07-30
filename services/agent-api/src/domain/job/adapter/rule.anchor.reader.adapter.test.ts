import { describe, expect, it } from "vitest";
import { TracerApiWindow } from "@tracer-agent/tracer-client";
import { RuleAnchorReaderAdapter } from "./rule.anchor.reader.adapter.js";

function makeAdapter(status: number, payload: unknown): {
    adapter: RuleAnchorReaderAdapter;
    calls: { readonly url: string; readonly user: string | undefined }[];
} {
    const calls: { readonly url: string; readonly user: string | undefined }[] = [];
    const window = new TracerApiWindow("http://tracer-api.test", async (url, init) => {
        const headers = new Headers(init.headers);
        calls.push({ url, user: headers.get("x-monitor-user") ?? undefined });
        return new Response(JSON.stringify(payload), {
            status,
            headers: { "content-type": "application/json" },
        });
    });
    return { adapter: new RuleAnchorReaderAdapter(window), calls };
}

describe("RuleAnchorReaderAdapter", () => {
    it("근거 이벤트를 창구에서 읽어 태스크와 발화 여부를 낸다", async () => {
        const { adapter, calls } = makeAdapter(200, {
            ok: true,
            data: { event: { id: "e1", taskId: "task-1", kind: "agent_tracer.user.message" } },
        });

        const anchor = await adapter.findById("local", "e1");

        expect(anchor).toEqual({ id: "e1", taskId: "task-1", userMessage: true });
        expect(calls[0]?.url).toContain("/api/v1/events/e1");
        expect(calls[0]?.user).toBe("local");
    });

    it("사용자 발화가 아닌 이벤트를 발화가 아니라고 낸다", async () => {
        const { adapter } = makeAdapter(200, {
            ok: true,
            data: { event: { id: "e2", taskId: "task-1", kind: "agent_tracer.tool.used" } },
        });

        expect(await adapter.findById("local", "e2")).toEqual({
            id: "e2",
            taskId: "task-1",
            userMessage: false,
        });
    });

    it("창구가 근거를 찾지 못하면 비운다", async () => {
        const { adapter } = makeAdapter(404, { ok: false, error: { code: "not_found" } });

        expect(await adapter.findById("local", "없다")).toBeNull();
    });
});
