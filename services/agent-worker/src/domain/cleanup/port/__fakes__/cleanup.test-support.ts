import type { AgentRunObservation } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import { CLEANUP_CANDIDATE_REASON, type CleanupCandidate } from "~agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import type {
    GenerateCleanupSuggestionsInput,
    GenerateCleanupSuggestionsOutput,
    CleanupAgentPort,
} from "~agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import type { CleanupIdGeneratorPort } from "~agent-worker/domain/cleanup/port/cleanup.id.generator.port.js";
import type { CleanupNotificationPort } from "~agent-worker/domain/cleanup/port/cleanup.notification.port.js";
import type {
    CleanupCommit,
    CleanupFailedAttempt,
    CleanupJobSnapshot,
    CleanupRepositoryPort,
    CleanupScanBatch,
} from "~agent-worker/domain/cleanup/port/cleanup.repository.port.js";
import { CLEANUP_SETTING_KEY } from "~agent-worker/domain/cleanup/model/cleanup.const.js";
import { foldAttempt, type JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";

export const NOW = new Date("2026-07-14T00:00:00.000Z");
const LONG_AGO = new Date("2026-01-01T00:00:00.000Z").toISOString();

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

export const fixedClock: IClock = new FixedClock();

export class CapturingCleanupNotification implements CleanupNotificationPort {
    readonly published: { readonly userId: string; readonly payload: Record<string, unknown> }[] = [];

    async jobUpdated(userId: string, payload: Record<string, unknown>): Promise<void> {
        this.published.push({ userId, payload });
    }
}

export class SequentialCleanupIdGenerator implements CleanupIdGeneratorPort {
    private position = 0;

    constructor(private readonly prefix = "cleanup-id") {}

    next(): string {
        this.position += 1;
        return `${this.prefix}-${this.position}`;
    }
}

export function cleanupIds(): SequentialCleanupIdGenerator {
    return new SequentialCleanupIdGenerator();
}

export class FakeCleanupAgent implements CleanupAgentPort {
    readonly calls: GenerateCleanupSuggestionsInput[] = [];
    failure: Error | null = null;

    constructor(
        private readonly output: GenerateCleanupSuggestionsOutput,
        private readonly needsApiKey = true,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.needsApiKey;
    }

    async generate(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput> {
        this.calls.push(input);
        if (this.failure !== null) throw this.failure;
        return this.output;
    }
}

/** cleanup 저장 포트를 메모리로 구현한 테스트 대역이다. */
export class InMemoryCleanupRepository implements CleanupRepositoryPort {
    readonly settings = new Map<string, string>();
    readonly failedAttempts: CleanupFailedAttempt[] = [];
    readonly commits: CleanupCommit[] = [];
    readonly failures: { readonly jobId: string; readonly message: string }[] = [];
    started: string[] = [];
    startWins = true;
    commitWins = true;
    batch: CleanupScanBatch = { tasks: [], activeChildParentIds: [], truncated: false, tasksScanned: 0 };
    private job: CleanupJobSnapshot | null = null;

    seedJob(job: CleanupJobSnapshot): void {
        this.job = job;
    }

    async findJob(jobId: string): Promise<CleanupJobSnapshot | null> {
        return this.job !== null && this.job.id === jobId ? this.job : null;
    }

    async startJob(jobId: string): Promise<boolean> {
        if (!this.startWins) return false;
        this.started.push(jobId);
        return true;
    }

    async readSetting(_scope: string, key: string): Promise<string | null> {
        return this.settings.get(key) ?? null;
    }

    async loadScanBatch(_userId: string): Promise<CleanupScanBatch> {
        return this.batch;
    }

    async recordFailedAttempt(input: CleanupFailedAttempt): Promise<void> {
        this.failedAttempts.push(input);
    }

    async foldSuccessAttempt(
        _jobId: string,
        record: JobAttemptRecord,
    ): Promise<{ readonly attempts: readonly JobAttemptRecord[] | undefined; readonly costUsd: number | null }> {
        const { attempts, totalCostUsd } = foldAttempt(this.job?.usage ?? {}, record);
        if (attempts.length <= 1) return { attempts: undefined, costUsd: record.costUsd };
        return { attempts, costUsd: totalCostUsd ?? record.costUsd };
    }

    async commitCleanup(input: CleanupCommit): Promise<{ readonly suggestionsCreated: number } | null> {
        if (!this.commitWins) return null;
        this.commits.push(input);
        return { suggestionsCreated: input.suggestions.length };
    }

    async failJob(jobId: string, message: string): Promise<CleanupJobSnapshot | null> {
        if (this.job === null || this.job.id !== jobId) return null;
        this.failures.push({ jobId, message });
        return this.job;
    }
}

export function candidate(overrides: Partial<CleanupCandidate> = {}): CleanupCandidate {
    return {
        id: "task-1",
        visibleTitle: "테스트",
        status: "completed",
        lastEventAt: null,
        hasEvents: false,
        activeChildCount: 0,
        candidateReasons: [CLEANUP_CANDIDATE_REASON.noEvents],
        ...overrides,
    };
}

export function seedRepository(): InMemoryCleanupRepository {
    const repository = new InMemoryCleanupRepository();
    repository.seedJob({ id: "job-1", userId: "user-1", usage: {} });
    repository.settings.set(CLEANUP_SETTING_KEY.anthropicApiKey, "sk-test");
    repository.batch = {
        tasks: [
            { id: "task-1", title: "테스트", status: "completed", lastEventAt: null, updatedAt: LONG_AGO },
            { id: "task-2", title: "인증 미들웨어 수정", status: "completed", lastEventAt: LONG_AGO, updatedAt: LONG_AGO },
        ],
        activeChildParentIds: [],
        truncated: false,
        tasksScanned: 2,
    };
    return repository;
}

export function cleanupObservation(overrides: Partial<AgentRunObservation> = {}): AgentRunObservation {
    return {
        executionId: "job-1",
        attemptId: "1",
        jobId: "job-1",
        experimentId: null,
        exampleId: null,
        variantId: null,
        agentName: "task-cleanup",
        backend: "claude-sdk",
        modelRequested: "claude-haiku-4-5",
        modelActual: "claude-haiku-4-5",
        promptVersion: "task-cleanup:auto:v1",
        promptContentHash: "sha256:abc",
        toolContractVersion: "1",
        evaluatorSetVersion: null,
        status: "succeeded",
        durationMs: 1_200,
        usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 },
        costUsd: 0.01,
        landed: false,
        repairAttempted: false,
        validation: { passed: true, errorCodes: [], citationPrecision: null, citationRecall: null },
        modelCalls: [],
        toolCalls: [],
        ...overrides,
    };
}

export function emptyOutput(
    overrides: Partial<GenerateCleanupSuggestionsOutput> = {},
): GenerateCleanupSuggestionsOutput {
    return {
        suggestions: [],
        modelUsed: "claude-haiku-4-5",
        durationMs: 1_200,
        costUsd: 0.01,
        numTurns: 2,
        usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0 },
        steps: [],
        observation: cleanupObservation(),
        ...overrides,
    };
}

export function attemptRun(
    attempt = 1,
): { attempt: number; idempotencyKey: string; abortSignal: AbortSignal } {
    return { attempt, idempotencyKey: "wf-1-act-1", abortSignal: new AbortController().signal };
}
