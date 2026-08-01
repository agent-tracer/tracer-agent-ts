import type { AgentRunObservation } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import type { TitleContext } from "~agent-worker/domain/title/model/title.context.model.js";
import type { GenerateTitleSuggestionsOutput } from "~agent-worker/domain/title/port/title.agent.port.js";
import type { TitleIdGeneratorPort } from "~agent-worker/domain/title/port/title.id.generator.port.js";
import type { TitleNotificationPort } from "~agent-worker/domain/title/port/title.notification.port.js";
import type {
    TitleFailedAttempt,
    TitleJobSnapshot,
    TitleRepositoryPort,
    TitleSuggestionCommit,
    TitleTaskContext,
} from "~agent-worker/domain/title/port/title.repository.port.js";
import type { PromptSourcePort } from "~agent-worker/domain/title/port/prompt.source.port.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { buildAgentPrompt, type AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { readAgentPrompt, readAgentTools } from "~agent-worker/support/contract.js";
import type { JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";

/** 계약이 선언한 조각으로 세운 프롬프트이며 조립 결과를 실제 본문으로 견주게 한다. */
export const TITLE_PROMPT: AgentPrompt = buildAgentPrompt(
    readAgentPrompt(AGENT.titleSuggestion.id),
    readAgentTools(AGENT.titleSuggestion.id).limits ?? {},
);

export class StubPromptSource implements PromptSourcePort {
    resolve(): Promise<AgentPrompt> {
        return Promise.resolve(TITLE_PROMPT);
    }
}

export const NOW = new Date("2026-07-01T00:00:00.000Z");

export class FixedClock implements IClock {
    constructor(private readonly current: Date = NOW) {}

    nowMs(): number {
        return this.current.getTime();
    }

    nowIso(): string {
        return this.current.toISOString();
    }

    now(): Date {
        return this.current;
    }
}

export class CapturingTitleNotification implements TitleNotificationPort {
    readonly sent: { userId: string; payload: Record<string, unknown> }[] = [];

    async jobUpdated(userId: string, payload: Record<string, unknown>): Promise<void> {
        this.sent.push({ userId, payload });
    }
}

export class SequentialTitleIdGenerator implements TitleIdGeneratorPort {
    private seq = 0;

    next(): string {
        this.seq += 1;
        return `step-${this.seq}`;
    }
}

export function titleContext(overrides: Partial<TitleContext> = {}): TitleContext {
    return {
        title: "Task 1",
        status: "completed",
        totalEventCount: 12,
        totalTurnCount: 2,
        truncated: false,
        turns: [{ turnIndex: 0, askedText: "인증을 고쳐줘", assistantText: "고쳤습니다" }],
        ...overrides,
    };
}

export function titleObservation(overrides: Partial<AgentRunObservation> = {}): AgentRunObservation {
    return {
        executionId: "job-1",
        attemptId: "1",
        jobId: "job-1",
        agentName: "title-suggestion",
        backend: "claude-sdk",
        modelRequested: "claude-haiku-4-5",
        modelActual: "claude-haiku-4-5",
        promptVersion: "v0.0.1",
        toolContractVersion: "v0.0.1",
        status: "succeeded",
        durationMs: 10,
        usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
        costUsd: 0.01,
        landed: false,
        repairAttempted: false,
        validation: { passed: true, errorCodes: [], citationPrecision: null, citationRecall: null },
        modelCalls: [],
        toolCalls: [],
        ...overrides,
    };
}

export function titleAgentOutput(
    overrides: Partial<GenerateTitleSuggestionsOutput> = {},
): GenerateTitleSuggestionsOutput {
    return {
        suggestions: [
            { title: "인증 미들웨어 토큰 누수 수정", rationale: "근거 하나" },
            { title: "인증 토큰 만료 처리 보강", rationale: "근거 둘" },
        ],
        modelUsed: "claude-haiku-4-5",
        durationMs: 10,
        costUsd: 0.01,
        numTurns: 1,
        usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 },
        steps: [],
        observation: titleObservation(),
        ...overrides,
    };
}

/** 잡 원장과 태스크 컨텍스트를 메모리로 대신하는 대역이다. */
export class InMemoryTitleRepository implements TitleRepositoryPort {
    job: TitleJobSnapshot | null = { id: "job-1", userId: "user-1", taskId: "task-1", usage: {} };

    taskContext: TitleTaskContext | null = {
        ownedByUser: true,
        totalEventCount: 12,
        context: titleContext(),
    };

    settings = new Map<string, string>();

    startable = true;

    committed: TitleSuggestionCommit | null = null;

    failedAttempts: TitleFailedAttempt[] = [];

    /** 종결 전이가 다른 실행에 밀린 상태를 만든다. */
    transitionLost = false;

    priorAttempts: readonly JobAttemptRecord[] = [];

    async findJob(jobId: string): Promise<TitleJobSnapshot | null> {
        return this.job !== null && this.job.id === jobId ? this.job : null;
    }

    async startJob(): Promise<boolean> {
        return this.startable;
    }

    async findTaskContext(): Promise<TitleTaskContext | null> {
        return this.taskContext;
    }

    async readSetting(scope: string, key: string): Promise<string | null> {
        return this.settings.get(`${scope}/${key}`) ?? null;
    }

    async recordFailedAttempt(input: TitleFailedAttempt): Promise<void> {
        this.failedAttempts.push(input);
    }

    async foldSuccessAttempt(
        _jobId: string,
        record: JobAttemptRecord,
    ): Promise<{
        readonly attempts: readonly JobAttemptRecord[] | undefined;
        readonly costUsd: number | null;
    }> {
        const attempts = [...this.priorAttempts, record];
        if (attempts.length <= 1) return { attempts: undefined, costUsd: record.costUsd };
        const known = attempts.filter((entry) => entry.costUsd !== null);
        return {
            attempts,
            costUsd: known.length === 0
                ? record.costUsd
                : known.reduce((sum, entry) => sum + (entry.costUsd ?? 0), 0),
        };
    }

    async commitSuggestions(
        input: TitleSuggestionCommit,
    ): Promise<{ readonly suggestionsCreated: number } | null> {
        if (this.transitionLost) return null;
        this.committed = input;
        return { suggestionsCreated: input.suggestions.length };
    }

    async failJob(jobId: string): Promise<TitleJobSnapshot | null> {
        if (this.transitionLost) return null;
        return this.job !== null && this.job.id === jobId ? this.job : null;
    }
}
