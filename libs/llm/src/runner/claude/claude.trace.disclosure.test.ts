import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentQueryRequest } from "~llm/runner/llm.runner.js";
import type { ClaudeQueryOptions } from "./claude.query.options.js";

interface CapturedClientOptions {
    hideInputs?: boolean | ((value: Record<string, unknown>) => Record<string, unknown>);
    hideOutputs?: boolean | ((value: Record<string, unknown>) => Record<string, unknown>);
}

const capturedClientOptions: CapturedClientOptions[] = [];
let rejectPostRun = false;
let rejectEndRun = false;

vi.mock("langsmith", () => {
    class FakeClient {
        constructor(options: CapturedClientOptions) {
            capturedClientOptions.push(options);
        }
    }
    class FakeRunTree {
        readonly name: string;
        readonly extra: { metadata: Record<string, unknown> };
        constructor(options: { name: string; extra: { metadata: Record<string, unknown> } }) {
            this.name = options.name;
            this.extra = options.extra;
        }
        async postRun(): Promise<void> {
            if (rejectPostRun) throw new Error("trace sink unavailable");
        }
        async patchRun(): Promise<void> {}
        async end(): Promise<void> {
            if (rejectEndRun) throw new Error("trace sink unavailable");
        }
    }
    return { Client: FakeClient, RunTree: FakeRunTree };
});

const { createClaudeRunTree, finishClaudeRunTree } = await import("./claude.trace.js");

function request(
    overrides: Partial<AgentQueryRequest<ClaudeQueryOptions>> = {},
): AgentQueryRequest<ClaudeQueryOptions> {
    return {
        label: "test-agent",
        prompt: "system prompt",
        systemPrompt: "",
        allowedTools: [],
        model: "claude-3-5-sonnet",
        maxTurns: 1,
        deadlineMs: 1000,
        env: {},
        ...overrides,
    };
}

async function captureStdout(run: () => Promise<void>): Promise<string> {
    const written: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
        written.push(String(chunk));
        return true;
    });
    try {
        await run();
    } finally {
        spy.mockRestore();
    }
    return written.join("");
}

const SECRET_FIXTURE = {
    apiKey: "sk-ant-live-should-not-leak",
    authorization: "Bearer lsv2_should-not-leak",
    callbackToken: "callback-should-not-leak",
    scopeToken: "scope-should-not-leak",
    userId: "user-should-not-leak",
    prompt: "평범한 프롬프트 본문",
};

describe("추적 원문 공개", () => {
    beforeEach(() => {
        capturedClientOptions.length = 0;
        rejectPostRun = false;
        rejectEndRun = false;
        process.env.LANGSMITH_TRACING = "true";
    });

    it("비공개 프로파일은 입력과 출력의 원문 전체를 막는다", async () => {
        await createClaudeRunTree(request(), false);

        expect(capturedClientOptions[0]).toEqual({ hideInputs: true, hideOutputs: true });
    });

    it("공개 프로파일에서도 걸린 입력을 통째로 내보내지 않는다", async () => {
        await createClaudeRunTree(request(), true);

        const options = capturedClientOptions[0];
        if (typeof options?.hideInputs !== "function") throw new Error("hideInputs must narrow when disclosed");

        expect(options.hideInputs(SECRET_FIXTURE)).toEqual({});
    });

    it("공개 프로파일에서도 걸린 출력을 통째로 내보내지 않는다", async () => {
        await createClaudeRunTree(request(), true);

        const options = capturedClientOptions[0];
        if (typeof options?.hideOutputs !== "function") throw new Error("hideOutputs must narrow when disclosed");

        expect(options.hideOutputs(SECRET_FIXTURE)).toEqual({});
    });

    it("공개 프로파일에서 걸리지 않은 payload 는 원문 그대로 내보낸다", async () => {
        await createClaudeRunTree(request(), true);

        const options = capturedClientOptions[0];
        if (typeof options?.hideInputs !== "function") throw new Error("hideInputs must narrow when disclosed");

        expect(options.hideInputs({ prompt: "평범한 프롬프트 본문" })).toEqual({
            prompt: "평범한 프롬프트 본문",
        });
    });

    it("추적 시작이 실패하면 경고를 남기고 모델 실행 경로로 전파하지 않는다", async () => {
        rejectPostRun = true;

        const written = await captureStdout(async () => {
            await expect(createClaudeRunTree(request(), true)).resolves.toBeNull();
        });

        expect(written).toContain("agent_trace.start.failed");
    });

    it("추적 종료가 실패하면 경고를 남기고 모델 결과 반환 경로로 전파하지 않는다", async () => {
        const runTree = await createClaudeRunTree(request(), true);
        if (runTree === null) throw new Error("runTree must exist before finish");
        rejectEndRun = true;

        const written = await captureStdout(async () => {
            await expect(finishClaudeRunTree(runTree, "result", null, null)).resolves.toBeUndefined();
        });

        expect(written).toContain("agent_trace.finish.failed");
    });
});
