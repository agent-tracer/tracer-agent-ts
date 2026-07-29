import { expect, it } from "vitest";
import { HttpEvaluationExecutionClient } from "./tracer-api.evaluation.execution.client.js";

it("평가 실행 내부 계약을 tracer-api에 멱등 요청한다", async () => {
    const calls: { url: string; body: string }[] = [];
    const client = new HttpEvaluationExecutionClient("http://tracer-api", async (url, init) => {
        const requestUrl = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        const body = init === undefined ? "" : typeof init.body === "string" ? init.body : "<body>";
        calls.push({ url: requestUrl, body });
        return new Response(null, { status: 204 });
    });
    await client.settle({
        userId: "user", executionId: "execution", attempt: 1, amount: 1, priorCostUsd: 0,
        jobId: "job", output: { ok: true }, durationMs: 2, traceId: null, costUsd: 0.1, scores: [],
        resolvedPromptHash: null,
    });
    expect(calls[0]).toMatchObject({ url: "http://tracer-api/internal/evaluation/executions/settle" });
    expect(JSON.parse(calls[0]!.body)).toMatchObject({ executionId: "execution", attempt: 1 });
});
