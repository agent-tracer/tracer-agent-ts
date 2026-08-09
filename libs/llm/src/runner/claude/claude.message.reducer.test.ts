import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";
import { AGENT_ERROR_SUBTYPE, PROVIDER_ERROR_SUBTYPE, UnpricedModelError } from "~llm/model/agent.error.js";
import { TrajectoryRecorder } from "~llm/observability/trajectory.js";
import { LandingPacer } from "~llm/runner/landing.pacer.js";
import type { AgentQueryRequest, AgentStreamSink } from "~llm/runner/llm.runner.js";
import { ClaudeMessageReducer } from "./claude.message.reducer.js";
import type { ClaudeQueryOptions } from "./claude.query.options.js";

const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

function request(
    overrides: Partial<AgentQueryRequest<ClaudeQueryOptions>> = {},
): AgentQueryRequest<ClaudeQueryOptions> {
    return {
        label: "test-agent",
        prompt: "prompt",
        systemPrompt: "system",
        allowedTools: [],
        model: "claude-opus-5",
        maxTurns: 20,
        deadlineMs: 5000,
        env: {},
        ...overrides,
    };
}

function assistant(overrides: Record<string, unknown> = {}): SDKMessage {
    return {
        type: "assistant",
        message: {
            content: [{ type: "text", text: "답" }],
            usage: USAGE,
            stop_reason: null,
            model: "claude-opus-5",
        },
        parent_tool_use_id: null,
        uuid: "u-a",
        session_id: "s-1",
        ...overrides,
    } as unknown as SDKMessage;
}

function result(overrides: Record<string, unknown> = {}): SDKMessage {
    return {
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 1,
        duration_api_ms: 1,
        num_turns: 2,
        result: "최종 답",
        total_cost_usd: 0.5,
        usage: USAGE,
        modelUsage: {},
        permission_denials: [],
        errors: [],
        stop_reason: "end_turn",
        uuid: "u-r",
        session_id: "s-1",
        ...overrides,
    } as unknown as SDKMessage;
}

function reducerOf(overrides: Partial<AgentQueryRequest<ClaudeQueryOptions>> = {}) {
    const deltas: string[] = [];
    const sink: AgentStreamSink = {
        onAssistantDelta: (text) => deltas.push(text),
        onToolCall: () => undefined,
        onToolResult: () => undefined,
    };
    const req = request(overrides);
    const reducer = new ClaudeMessageReducer({
        request: req,
        trajectory: new TrajectoryRecorder(() => 0),
        pacer: new LandingPacer(req.maxTurns, req.maxBudgetUsd),
        sink,
    });
    return { reducer, deltas };
}

describe("SDK 메시지를 실행 결과로 접는 자리", () => {
    it("결과 메시지를 받으면 더 접을 것이 없다고 알린다", () => {
        const { reducer } = reducerOf();

        expect(reducer.acceptAndContinue(assistant())).toBe(true);
        expect(reducer.acceptAndContinue(result())).toBe(false);
    });

    it("결과가 준 산출을 어시스턴트가 흘린 글보다 앞세운다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(assistant());
        reducer.acceptAndContinue(result({ result: "최종 답" }));

        expect(reducer.snapshot().rawOutput).toBe("최종 답");
    });

    it("결과를 받지 못하면 흘린 글을 산출로 쓴다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(assistant());

        expect(reducer.snapshot().rawOutput).toBe("답");
    });

    it("성공 모양이어도 거절로 끝난 결과는 오류로 적는다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(result({ stop_reason: "refusal" }));

        expect(reducer.snapshot().errorSubtype).toBe(PROVIDER_ERROR_SUBTYPE.refusal);
    });

    it("실패 서브타입을 이 실행기의 어휘로 옮겨 적는다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(result({ subtype: "error_max_turns", errors: ["턴을 다 썼다"] }));

        const snapshot = reducer.snapshot();
        expect(snapshot.errorSubtype).toBe(AGENT_ERROR_SUBTYPE.maxTurnsExceeded);
        expect(snapshot.errorSummary).toContain("턴을 다 썼다");
    });

    it("실패로 끝난 결과에는 첫 토큰까지의 시간을 적지 않는다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(result({ subtype: "error_during_execution", ttft_ms: 12 }));

        expect(reducer.snapshot().ttftMs).toBeNull();
    });

    it("모델을 여러 번 부르면 마지막 호출의 공급자 식별자를 적는다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(assistant({ request_id: "req-1" }));
        reducer.acceptAndContinue(assistant({ request_id: "req-2" }));

        expect(reducer.snapshot().providerRequestId).toBe("req-2");
    });

    it("예산을 걸지 않은 실행은 단가를 몰라도 끊지 않는다", () => {
        const { reducer } = reducerOf();

        expect(() =>
            reducer.acceptAndContinue(
                assistant({
                    message: { content: [], usage: USAGE, stop_reason: null, model: "이름-없는-모델" },
                }),
            ),
        ).not.toThrow();
    });

    it("예산을 건 실행이 단가를 모르는 모델을 만나면 끊는다", () => {
        const { reducer } = reducerOf({ maxBudgetUsd: 1 });

        expect(() =>
            reducer.acceptAndContinue(
                assistant({
                    message: { content: [], usage: USAGE, stop_reason: null, model: "이름-없는-모델" },
                }),
            ),
        ).toThrow(UnpricedModelError);
    });

    it("공급자가 한도로 막은 실행은 재시도 가능한 사유로 적는다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(result({ subtype: "error_during_execution", terminal_reason: "blocking_limit" }));

        expect(reducer.snapshot().errorSubtype).toBe(PROVIDER_ERROR_SUBTYPE.rateLimit);
    });

    it("급속 충전 차단기도 같은 자리로 접는다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(result({ subtype: "error_during_execution", terminal_reason: "rapid_refill_breaker" }));

        expect(reducer.snapshot().errorSubtype).toBe(PROVIDER_ERROR_SUBTYPE.rateLimit);
    });

    it("입력이 창을 넘긴 실행은 다시 불러도 같으므로 요청 과대로 적는다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(result({ subtype: "error_during_execution", terminal_reason: "prompt_too_long" }));

        expect(reducer.snapshot().errorSubtype).toBe(PROVIDER_ERROR_SUBTYPE.requestTooLarge);
    });

    it("결과 서브타입이 이미 말하는 까닭은 그대로 둔다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(result({ subtype: "error_max_turns", terminal_reason: "max_turns" }));

        expect(reducer.snapshot().errorSubtype).toBe(AGENT_ERROR_SUBTYPE.maxTurnsExceeded);
    });

    it("끝낸 까닭이 없으면 서브타입 판정을 그대로 쓴다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(result({ subtype: "error_during_execution" }));

        expect(reducer.snapshot().errorSubtype).toBe(AGENT_ERROR_SUBTYPE.executionError);
    });

    it("출력 한도에서 끊긴 답은 성공 모양이어도 절단으로 적는다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(result({ stop_reason: "max_tokens", result: "잘린 답" }));

        expect(reducer.snapshot().errorSubtype).toBe(AGENT_ERROR_SUBTYPE.maxTokens);
    });

    it("절단된 답이라도 그때까지 받은 글은 버리지 않는다", () => {
        const { reducer } = reducerOf();

        reducer.acceptAndContinue(result({ stop_reason: "max_tokens", result: "잘린 답" }));

        expect(reducer.snapshot().rawOutput).toBe("잘린 답");
    });
});
