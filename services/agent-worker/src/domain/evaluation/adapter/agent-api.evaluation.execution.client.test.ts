import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { describe, expect, it } from "vitest";
import { HttpEvaluationExecutionClient } from "./agent-api.evaluation.execution.client.js";

interface Call {
    readonly url: string;
    readonly body: Record<string, unknown>;
    readonly user: string | null;
}

function clientWith(reply: () => Response) {
    const calls: Call[] = [];
    const client = new HttpEvaluationExecutionClient("http://agent-api", async (url, init) => {
        const requestUrl = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        const headers = new Headers(init?.headers);
        calls.push({
            url: requestUrl,
            body: JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<string, unknown>,
            user: headers.get(MONITOR_USER_HEADER),
        });
        return reply();
    });
    return { client, calls };
}

const envelope = (data: unknown) => () => new Response(JSON.stringify({ ok: true, data }), {
    status: 200, headers: { "content-type": "application/json" },
});

const SETTLEMENT = {
    userId: "user-1", executionId: "execution-1", attempt: 1, amount: 1, priorCostUsd: 0,
    jobId: "job-1", output: { ok: true }, durationMs: 2, traceId: null, costUsd: 0.1,
    scores: [], resolvedPromptHash: null,
};

describe("평가 실행 내부 창구", () => {
    it("실행 원장을 소유한 agent-api 를 부른다", async () => {
        const { client, calls } = clientWith(envelope({ settled: true }));

        await client.settle(SETTLEMENT);

        expect(calls[0]?.url).toBe("http://agent-api/internal/evaluation/executions/settle");
    });

    it("네 창구가 각자의 경로를 부른다", async () => {
        const { client, calls } = clientWith(envelope(null));

        await client.lease({ userId: "user-1", experimentId: "experiment-1" });
        await client.settle(SETTLEMENT);
        await client.release({ userId: "user-1", executionId: "execution-1", attempt: 1, terminal: true });
        await client.finalize({ userId: "user-1", experimentId: "experiment-1", cancelled: false, failed: false, budgetExhausted: false });

        expect(calls.map((call) => call.url.replace("http://agent-api/internal/evaluation", ""))).toEqual([
            "/executions/lease", "/executions/settle", "/executions/release", "/experiments/finalize",
        ]);
    });

    it("사용자를 본문이 아니라 머리말로 싣는다", async () => {
        const { client, calls } = clientWith(envelope({ settled: true }));

        await client.settle(SETTLEMENT);

        expect(calls[0]?.user).toBe("user-1");
        expect(calls[0]?.body).not.toHaveProperty("userId");
    });

    it("정산 봉투가 시도와 결과와 점수를 담는다", async () => {
        const { client, calls } = clientWith(envelope({ settled: true }));

        await client.settle({ ...SETTLEMENT, attempt: 3, costUsd: 0.5, resolvedPromptHash: "hash-1" });

        expect(calls[0]?.body).toMatchObject({
            executionId: "execution-1", attempt: 3, jobId: "job-1", costUsd: 0.5,
            durationMs: 2, resolvedPromptHash: "hash-1", scores: [],
        });
    });

    it("봉투를 벗겨 실행을 낸다", async () => {
        const { client } = clientWith(envelope({ execution: { id: "execution-1" }, amount: 3, priorCostUsd: 1 }));

        const leased = await client.lease({ userId: "user-1", experimentId: "experiment-1" });

        expect(leased).toMatchObject({ execution: { id: "execution-1" }, amount: 3, priorCostUsd: 1 });
    });

    it("가져갈 실행이 없으면 null 을 낸다", async () => {
        const { client } = clientWith(envelope(null));

        expect(await client.lease({ userId: "user-1", experimentId: "experiment-1" })).toBeNull();
    });

    it("창구가 거절하면 그 상태를 알린다", async () => {
        const { client } = clientWith(() => new Response(null, { status: 404 }));

        await expect(client.lease({ userId: "user-1", experimentId: "experiment-1" }))
            .rejects.toThrow("evaluation-internal-http-404");
    });
});
