import { AgentExecutionFailure } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import type { TitleSuggestionPrep } from "~agent-worker/domain/title/model/title.job.model.js";
import { resolveTitlePromptPin } from "~agent-worker/domain/title/model/title.prompt.js";
import type {
    GenerateTitleSuggestionsInput,
    GenerateTitleSuggestionsOutput,
    TitleAgentPort,
} from "~agent-worker/domain/title/port/title.agent.port.js";
import {
    FixedClock,
    InMemoryTitleRepository,
    SequentialTitleIdGenerator,
    titleAgentOutput,
    titleContext,
    TITLE_PROMPT,
} from "~agent-worker/domain/title/port/__fakes__/title.test-support.js";
import { SuggestTitleUsecase } from "./suggest.title.usecase.js";

const PREP: TitleSuggestionPrep = {
    jobId: "job-1",
    userId: "user-1",
    taskId: "task-1",
    language: "auto",
    currentTitle: "Task 1",
    context: titleContext(),
    prompt: resolveTitlePromptPin(TITLE_PROMPT, "auto"),
};

class FakeTitleAgent implements TitleAgentPort {
    lastInput: GenerateTitleSuggestionsInput | null = null;

    constructor(
        private readonly behavior: () => Promise<GenerateTitleSuggestionsOutput> = () =>
            Promise.resolve(titleAgentOutput()),
        private readonly needsKey = false,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.needsKey;
    }

    generate(input: GenerateTitleSuggestionsInput): Promise<GenerateTitleSuggestionsOutput> {
        this.lastInput = input;
        return this.behavior();
    }
}

function setup(agent: TitleAgentPort) {
    const repository = new InMemoryTitleRepository();
    return {
        repository,
        usecase: new SuggestTitleUsecase(
            repository,
            agent,
            new FixedClock(),
            new SequentialTitleIdGenerator(),
        ),
    };
}

const RUN = { attempt: 1, idempotencyKey: "key-1", abortSignal: new AbortController().signal };

describe("SuggestTitleUsecase", () => {
    it("에이전트가 낸 제안을 그대로 낸다", async () => {
        const { usecase } = setup(new FakeTitleAgent());

        const output = await usecase.execute(PREP, RUN);

        expect(output.suggestions).toHaveLength(2);
        expect(output.attempt).toBe(1);
    });

    it("궤적 한 줄마다 저장 식별자를 붙인다", async () => {
        const agent = new FakeTitleAgent(() =>
            Promise.resolve(
                titleAgentOutput({
                    steps: [
                        { seq: 0, role: "assistant", content: "봤다", truncated: false, toolCalls: [] },
                    ],
                }),
            ),
        );
        const { usecase } = setup(agent);

        expect((await usecase.execute(PREP, RUN)).jobSteps[0]?.id).toBe("step-1");
    });

    it("검증에 걸린 제안은 저장하지 않고 관측에 사유를 남긴다", async () => {
        const agent = new FakeTitleAgent(() =>
            Promise.resolve(
                titleAgentOutput({ suggestions: [{ title: "Task 1", rationale: "같은 제목" }] }),
            ),
        );
        const { usecase } = setup(agent);

        const output = await usecase.execute(PREP, RUN);

        expect(output.suggestions).toEqual([]);
        expect(output.observation.validation).toMatchObject({
            passed: false,
            errorCodes: ["title_validation_failed"],
        });
    });

    it("러너가 자격을 요구하면 설정에서 읽은 키를 실어 보낸다", async () => {
        const agent = new FakeTitleAgent(undefined, true);
        const { repository, usecase } = setup(agent);
        repository.settings.set("user-1/anthropic.api_key", "sk-test");

        await usecase.execute(PREP, RUN);

        expect(agent.lastInput?.apiKey).toBe("sk-test");
    });

    it("실행이 무너지면 시도 이력을 남기고 실패를 올린다", async () => {
        const failure = new AgentExecutionFailure("title-suggestion", "AGENT_FAILED", "boom", {
            errorSubtype: "process_error",
        });
        const { repository, usecase } = setup(new FakeTitleAgent(() => Promise.reject(failure)));

        await expect(usecase.execute(PREP, RUN)).rejects.toBe(failure);
        expect(repository.failedAttempts).toHaveLength(1);
        expect(repository.failedAttempts[0]?.record).toMatchObject({ attempt: 1, status: "failed" });
    });

    it("재시도가 있었으면 시도 이력과 누적 비용을 함께 낸다", async () => {
        const { repository, usecase } = setup(new FakeTitleAgent());
        repository.priorAttempts = [
            {
                attempt: 1,
                status: "failed",
                subtype: "process_error",
                model: "claude-haiku-4-5",
                costUsd: 0.02,
                durationMs: 5,
                usage: null,
                errorMessage: "boom",
                providerRequestId: null,
            },
        ];

        const output = await usecase.execute(PREP, { ...RUN, attempt: 2 });

        expect(output.attempts).toHaveLength(2);
        expect(output.costUsd).toBeCloseTo(0.03);
    });
});
