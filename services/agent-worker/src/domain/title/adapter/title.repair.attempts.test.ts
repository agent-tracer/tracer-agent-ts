import { describe, expect, it } from "vitest";
import { loadExecutionBudgetContract } from "@tracer-agent/llm";
import type { AgentQueryResult, ClaudeQueryOptions, IQueryRunner } from "@tracer-agent/llm";
import {
    StubPromptSource,
    titleContext,
} from "~agent-worker/domain/title/port/__fakes__/title.test-support.js";
import type { TitleEventReaderPort } from "~agent-worker/domain/title/port/title.event.reader.port.js";
import { TitleAgentAdapter } from "./title.agent.adapter.js";

const REPAIR_ATTEMPTS = loadExecutionBudgetContract().reservation.repair.attempts;

/** 스키마는 통과하지만 자리표시자라 쓸 수 있는 후보가 남지 않는 산출이며 이것을 받으면 한 번 더 요청한다. */
const REJECTED = {
    suggestions: [
        { title: "untitled", rationale: "쓸 수 없는 자리표시자다" },
        { title: "task 1", rationale: "이것도 자리표시자다" },
    ],
};
const ACCEPTED = {
    suggestions: [
        { title: "결제 웹훅 재시도 흐름 정리", rationale: "이 대화가 그 흐름을 고쳤다" },
        { title: "웹훅 재시도 백오프 도입", rationale: "간격을 늘리는 변경이 있었다" },
    ],
};

function result(structuredOutput: unknown): AgentQueryResult {
    return {
        rawOutput: JSON.stringify(structuredOutput),
        structuredOutput,
        durationMs: 1,
        numTurns: 1,
        costUsd: 0,
        usage: null,
        steps: [],
        errorSummary: null,
        errorSubtype: null,
        landed: false,
        actualModel: "claude-haiku-4-5",
        providerRequestId: null,
        ttftMs: null,
        startupMs: null,
    };
}

/** 요청을 세는 실행기 대역이며 산출을 순서대로 내주고 실물이 지우는 것은 공급자 호출과 그 지연뿐이다. */
class CountingRunner implements IQueryRunner<ClaudeQueryOptions> {
    readonly prompts: string[] = [];

    constructor(private readonly outputs: readonly unknown[]) {}

    requiresLocalApiKey(): boolean {
        return false;
    }

    run(request: { readonly prompt: string }): Promise<AgentQueryResult> {
        const next = this.outputs[Math.min(this.prompts.length, this.outputs.length - 1)];
        this.prompts.push(request.prompt);
        return Promise.resolve(result(next));
    }
}

const EVENTS: TitleEventReaderPort = {
    listTaskEvents: () => Promise.resolve([]),
} as unknown as TitleEventReaderPort;

function generate(runner: CountingRunner): Promise<unknown> {
    return new TitleAgentAdapter(runner, EVENTS, new StubPromptSource()).generate({
        jobId: "job-1",
        userId: "user-1",
        taskId: "task-1",
        attempt: 0,
        language: "auto",
        context: titleContext(),
        prompt: { promptVersion: "v0.0.1", toolContractVersion: "v0.0.1" },
    });
}

describe("검증에 걸린 산출을 다시 받는 횟수", () => {
    it("계약이 그 횟수를 갖는다", () => {
        expect(REPAIR_ATTEMPTS).toBeGreaterThan(0);
    });

    // 다시 받은 산출이 통과하면 그 뒤로는 더 부르지 않는다.
    it("첫 산출이 걸리면 계약이 적은 횟수만큼만 더 부른다", async () => {
        const runner = new CountingRunner([REJECTED, ACCEPTED]);

        await generate(runner);

        expect(runner.prompts).toHaveLength(1 + REPAIR_ATTEMPTS);
    });

    // 다시 받은 산출도 걸리면 더 부르지 않고 빈 결과로 끝난다.
    it("다시 받은 산출도 걸리면 그 이상 부르지 않는다", async () => {
        const runner = new CountingRunner([REJECTED]);

        await generate(runner);

        expect(runner.prompts).toHaveLength(1 + REPAIR_ATTEMPTS);
    });
});
