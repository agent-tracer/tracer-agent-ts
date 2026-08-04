import { TracerApiWindow, type HttpRequestInit } from "@tracer-agent/tracer-client";
import { describe, expect, it } from "vitest";
import { readTracerOutputsCase } from "~agent-worker/support/contract.js";
import { CleanupOutputAdapter } from "./cleanup.output.adapter.js";

const outputs = readTracerOutputsCase();
const window = outputs.windows.find((entry) => entry.path === "/api/v1/task-cleanup/suggestions")!;

interface Sent {
    readonly url: string;
    readonly init: HttpRequestInit;
}

function adapterWith(payload: unknown): { target: CleanupOutputAdapter; sent: Sent[] } {
    const sent: Sent[] = [];
    const tracer = new TracerApiWindow("http://tracer-api:3902", (url, init) => {
        sent.push({ url, init });
        return Promise.resolve({ status: 201, text: () => Promise.resolve(JSON.stringify(payload)) });
    });
    return { target: new CleanupOutputAdapter(tracer), sent };
}

function batch() {
    return {
        userId: "local",
        jobId: "job-1",
        suggestions: [{ kind: "archive" as const, taskId: "t1", rationale: "이벤트가 없다", evidenceEventIds: ["e1"] }],
    };
}

function sentBody(sent: readonly Sent[]): Record<string, unknown> {
    return JSON.parse(sent[0]!.init.body!) as Record<string, unknown>;
}

describe("CleanupOutputAdapter", () => {
    it("계약이 적은 창구로 제안 한 벌을 보낸다", async () => {
        const { target, sent } = adapterWith({ ok: true, data: { suggestions: [{ id: "s1" }] } });

        await expect(target.createSuggestions(batch())).resolves.toBe(1);
        expect(sent[0]!.url).toBe(`http://tracer-api:3902${window.path}`);
        expect(sent[0]!.init.method).toBe(window.method);
    });

    it("본문의 칸이 계약이 적은 목록 안에 있다", async () => {
        const { target, sent } = adapterWith({ ok: true, data: { suggestions: [{ id: "s1" }] } });

        await target.createSuggestions(batch());

        const body = sentBody(sent);
        const allowed = [...window.body.required, ...window.body.optional];
        expect(Object.keys(body).every((field) => allowed.includes(field))).toBe(true);
        expect(window.body.required.every((field) => Object.hasOwn(body, field))).toBe(true);
    });

    it("제안 한 건의 칸이 계약이 적은 초안의 칸과 같다", async () => {
        const { target, sent } = adapterWith({ ok: true, data: { suggestions: [{ id: "s1" }] } });

        await target.createSuggestions(batch());

        const draft = (sentBody(sent)["suggestions"] as Record<string, unknown>[])[0]!;
        expect(Object.keys(draft).sort()).toEqual([...outputs.drafts.cleanupSuggestion.required].sort());
    });

    it("멱등을 만드는 태스크와 종류를 빠짐없이 싣는다", async () => {
        const { target, sent } = adapterWith({ ok: true, data: { suggestions: [{ id: "s1" }] } });

        await target.createSuggestions(batch());

        const draft = (sentBody(sent)["suggestions"] as Record<string, unknown>[])[0]!;
        for (const field of outputs.idempotency.cleanupSuggestions.key.split("+")) {
            expect(Object.hasOwn(draft, field.trim())).toBe(true);
        }
    });

    it("보낼 제안이 없으면 창구를 부르지 않는다", async () => {
        const { target, sent } = adapterWith({ ok: true, data: { suggestions: [] } });

        await expect(target.createSuggestions({ userId: "local", jobId: "job-1", suggestions: [] })).resolves.toBe(0);
        expect(sent).toEqual([]);
    });
});
