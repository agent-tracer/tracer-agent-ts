import { describe, expect, it, vi } from "vitest";

const queryMock = vi.fn<(...args: unknown[]) => AsyncGenerator<unknown>>();

const SYSTEM_PROMPT_DYNAMIC_BOUNDARY = "<<<SYSTEM_PROMPT_DYNAMIC_BOUNDARY>>>";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
    query: (...args: unknown[]): AsyncGenerator<unknown> => queryMock(...args),
    SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
}));

const { ClaudeQueryRunner } = await import("./claude.query.runner.js");
const { AGENT_ERROR_SUBTYPE, PROVIDER_ERROR_SUBTYPE } = await import("~llm/model/agent.error.js");

import type { AgentQueryRequest } from "~llm/runner/llm.runner.js";
import type { ClaudeQueryOptions } from "./claude.query.options.js";

function request(
    overrides: Partial<AgentQueryRequest<ClaudeQueryOptions>> = {},
): AgentQueryRequest<ClaudeQueryOptions> {
    return {
        label: "test-agent",
        prompt: "prompt",
        systemPrompt: "system",
        allowedTools: [],
        model: "claude-opus-5",
        maxTurns: 4,
        deadlineMs: 5000,
        env: {},
        ...overrides,
    };
}

const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

async function* stream(messages: readonly unknown[]): AsyncGenerator<unknown> {
    for (const message of messages) yield message;
}

describe("모델 거절 판정", () => {
    it("stop_reason이 refusal인 성공 모양 결과를 오류로 판정한다", async () => {
        queryMock.mockReturnValue(
            stream([
                {
                    type: "result",
                    subtype: "success",
                    is_error: false,
                    duration_ms: 1,
                    duration_api_ms: 1,
                    num_turns: 1,
                    result: "I can't help with that.",
                    stop_reason: "refusal",
                    total_cost_usd: 0,
                    usage: USAGE,
                    modelUsage: {},
                    permission_denials: [],
                    uuid: "u-1",
                    session_id: "s-1",
                },
            ]),
        );

        const runner = new ClaudeQueryRunner(true);
        const result = await runner.run(request());

        expect(result.errorSubtype).toBe(PROVIDER_ERROR_SUBTYPE.refusal);
        expect(result.rawOutput).toBe("");
        expect(result.structuredOutput).toBeNull();
    });

    it("stop_reason이 없는 성공 결과는 그대로 산출로 쓴다", async () => {
        queryMock.mockReturnValue(
            stream([
                {
                    type: "result",
                    subtype: "success",
                    is_error: false,
                    duration_ms: 1,
                    duration_api_ms: 1,
                    num_turns: 1,
                    result: "answer",
                    stop_reason: "end_turn",
                    total_cost_usd: 0,
                    usage: USAGE,
                    modelUsage: {},
                    permission_denials: [],
                    uuid: "u-2",
                    session_id: "s-2",
                },
            ]),
        );

        const runner = new ClaudeQueryRunner(true);
        const result = await runner.run(request());

        expect(result.errorSubtype).toBeNull();
        expect(result.rawOutput).toBe("answer");
    });

    it("공급자 서브타입을 이 실행기의 오류 어휘로 정규화한다", async () => {
        queryMock.mockReturnValue(
            stream([
                {
                    type: "result",
                    subtype: "error_max_turns",
                    is_error: true,
                    duration_ms: 1,
                    duration_api_ms: 1,
                    num_turns: 4,
                    stop_reason: null,
                    total_cost_usd: 0,
                    usage: USAGE,
                    modelUsage: {},
                    permission_denials: [],
                    errors: [],
                    uuid: "u-3",
                    session_id: "s-3",
                },
            ]),
        );

        const runner = new ClaudeQueryRunner(true);
        const result = await runner.run(request());

        expect(result.errorSubtype).toBe(AGENT_ERROR_SUBTYPE.maxTurnsExceeded);
    });
});

function assistant(requestId: string | undefined, text: string): unknown {
    return {
        type: "assistant",
        message: { content: [{ type: "text", text }], usage: USAGE, stop_reason: null },
        parent_tool_use_id: null,
        uuid: "u-a",
        session_id: "s-1",
        ...(requestId !== undefined ? { request_id: requestId } : {}),
    };
}

function done(overrides: Record<string, unknown> = {}): unknown {
    return {
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 1,
        duration_api_ms: 1,
        num_turns: 1,
        result: "",
        total_cost_usd: 0,
        usage: USAGE,
        modelUsage: {},
        permission_denials: [],
        uuid: "u-1",
        session_id: "s-1",
        ...overrides,
    };
}

describe("첫 토큰까지의 시간", () => {
    it("공급자가 잰 값을 그대로 관측에 싣는다", async () => {
        queryMock.mockClear();
        queryMock.mockReturnValue(stream([done({ ttft_ms: 420 })]));

        const result = await new ClaudeQueryRunner(true).run(request());

        expect(result.ttftMs).toBe(420);
    });

    it("재지 못한 실행은 0 이 아니라 비운다", async () => {
        queryMock.mockClear();
        queryMock.mockReturnValue(stream([done()]));

        const result = await new ClaudeQueryRunner(true).run(request());

        expect(result.ttftMs).toBeNull();
    });
});

describe("공급자 요청 식별자", () => {
    it("모델 호출이 낸 값을 그대로 적는다", async () => {
        queryMock.mockReturnValue(stream([assistant("req-1", "안녕"), done()]));

        const result = await new ClaudeQueryRunner(true).run(request());

        expect(result.providerRequestId).toBe("req-1");
    });

    it("한 실행이 모델을 여러 번 부르면 마지막 호출의 값을 적는다", async () => {
        queryMock.mockReturnValue(stream([assistant("req-1", "하나"), assistant("req-2", "둘"), done()]));

        const result = await new ClaudeQueryRunner(true).run(request());

        expect(result.providerRequestId).toBe("req-2");
    });

    it("공급자가 값을 내지 않으면 비운다", async () => {
        queryMock.mockReturnValue(stream([assistant(undefined, "안녕"), done()]));

        const result = await new ClaudeQueryRunner(true).run(request());

        expect(result.providerRequestId).toBeNull();
    });

    it("세션 식별자를 그 자리에 채우지 않는다", async () => {
        queryMock.mockReturnValue(stream([assistant(undefined, "안녕"), done()]));

        const result = await new ClaudeQueryRunner(true).run(request());

        expect(result.providerRequestId).not.toBe("s-1");
    });
});

function passedEnv(): Record<string, string | undefined> {
    const [call] = queryMock.mock.calls;
    const { options } = call![0] as { options: { env: Record<string, string | undefined> } };
    return options.env;
}

describe("출력 한도 전달", () => {
    it("봉투가 한도를 정하면 하위 프로세스 환경이 그 값을 갖는다", async () => {
        queryMock.mockClear();
        queryMock.mockReturnValue(stream([done()]));

        await new ClaudeQueryRunner(true).run(request({ maxOutputTokens: 16000 }));

        expect(passedEnv()["CLAUDE_CODE_MAX_OUTPUT_TOKENS"]).toBe("16000");
    });

    it("봉투가 한도를 정하지 않으면 그 이름이 환경에 없다", async () => {
        queryMock.mockClear();
        queryMock.mockReturnValue(stream([done()]));

        await new ClaudeQueryRunner(true).run(request());

        expect(passedEnv()).not.toHaveProperty("CLAUDE_CODE_MAX_OUTPUT_TOKENS");
    });
});

function passedOptions(): { settingSources: readonly string[]; skills: string[] | "all" } {
    const [call] = queryMock.mock.calls;
    const { options } = call![0] as {
        options: { settingSources: readonly string[]; skills: string[] | "all" };
    };
    return options;
}

describe("실행 표면", () => {
    it("운영 프로파일은 컨테이너의 설정과 스킬을 읽지 않는다", async () => {
        queryMock.mockClear();
        queryMock.mockReturnValue(stream([done()]));

        await new ClaudeQueryRunner(false).run(request());

        expect(passedOptions().settingSources).toEqual([]);
        expect(passedOptions().skills).toEqual([]);
    });

    it("로컬 프로파일은 사용자 설정과 스킬을 그대로 쓴다", async () => {
        queryMock.mockClear();
        queryMock.mockReturnValue(stream([done()]));

        await new ClaudeQueryRunner(true).run(request());

        expect(passedOptions().settingSources).toEqual(["user"]);
        expect(passedOptions().skills).toBe("all");
    });
});

function passedSystemPrompt(): unknown {
    const [call] = queryMock.mock.calls;
    const { options } = call![0] as { options: { systemPrompt: unknown } };
    return options.systemPrompt;
}

describe("프롬프트 캐시 경계", () => {
    it("턴별 맥락이 있으면 정적 접두부와 그 사이에 경계를 세운다", async () => {
        queryMock.mockClear();
        queryMock.mockReturnValue(stream([done()]));

        await new ClaudeQueryRunner(true).run(
            request({ systemPrompt: "정적 지침", dynamicSystemPrompt: "이번 턴 맥락" }),
        );

        expect(passedSystemPrompt()).toEqual(["정적 지침", SYSTEM_PROMPT_DYNAMIC_BOUNDARY, "이번 턴 맥락"]);
    });

    it("턴별 맥락이 없으면 지침 하나를 그대로 넘긴다", async () => {
        queryMock.mockClear();
        queryMock.mockReturnValue(stream([done()]));

        await new ClaudeQueryRunner(true).run(request({ systemPrompt: "정적 지침" }));

        expect(passedSystemPrompt()).toBe("정적 지침");
    });
});
