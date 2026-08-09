import { AGENT_BACKEND, type AgentRunObservation } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import { RECIPE_SETTING_KEY } from "~agent-worker/domain/recipe/model/recipe.const.js";
import type {
    GenerateRecipeCandidatesInput,
    GenerateRecipeCandidatesOutput,
    RecipeAgentPort,
} from "~agent-worker/domain/recipe/port/recipe.agent.port.js";
import type { IdGeneratorPort } from "~agent-worker/support/id.generator.port.js";
import type { JobNotificationPort } from "~agent-worker/support/job.notification.port.js";
import type {
    RecipeCandidateBatch,
    RecipeOutputPort,
} from "~agent-worker/domain/recipe/port/recipe.output.port.js";
import type {
    RecipeFailedAttempt,
    RecipeJobLedgerPort,
    RecipeJobSnapshot,
    RecipeScanCommit,
} from "~agent-worker/domain/recipe/port/recipe.job.ledger.port.js";
import type { RecipeSettingReaderPort } from "~agent-worker/domain/recipe/port/setting.reader.port.js";
import type {
    RecipeAnchorSnapshot,
    RecipeTaskReaderPort,
} from "~agent-worker/domain/recipe/port/recipe.task.reader.port.js";
import type { PromptSourcePort } from "~agent-worker/support/prompt.source.port.js";
import type { RecipeToolContract } from "~agent-worker/domain/recipe/model/recipe.tool.schema.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { buildAgentPrompt, type AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { readAgentPrompt, readAgentTools } from "~agent-worker/support/contract.js";
import { foldAttempt, type JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";

const RECIPE_TOOLS = readAgentTools<RecipeToolContract>(AGENT.recipeScan.id);

/** 계약이 선언한 조각으로 세운 프롬프트이며 조립 결과를 실제 본문과 비교하게 한다. */
export const RECIPE_PROMPT: AgentPrompt = buildAgentPrompt(readAgentPrompt(AGENT.recipeScan.id), {
    ...(RECIPE_TOOLS.limits ?? {}),
});

export class StubPromptSource implements PromptSourcePort {
    resolve(): Promise<AgentPrompt> {
        return Promise.resolve(RECIPE_PROMPT);
    }
}

export const NOW = new Date("2026-07-14T00:00:00.000Z");

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

export class CapturingRecipeNotification implements JobNotificationPort {
    readonly published: { readonly userId: string; readonly payload: Record<string, unknown> }[] = [];

    async jobUpdated(userId: string, payload: Record<string, unknown>): Promise<void> {
        this.published.push({ userId, payload });
    }
}

export class SequentialRecipeIdGenerator implements IdGeneratorPort {
    private position = 0;

    constructor(private readonly prefix = "recipe-id") {}

    next(): string {
        this.position += 1;
        return `${this.prefix}-${this.position}`;
    }
}

export class FakeRecipeAgent implements RecipeAgentPort {
    readonly calls: GenerateRecipeCandidatesInput[] = [];
    failure: Error | null = null;

    constructor(
        private readonly output: GenerateRecipeCandidatesOutput,
        private readonly needsApiKey = true,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.needsApiKey;
    }

    async generate(input: GenerateRecipeCandidatesInput): Promise<GenerateRecipeCandidatesOutput> {
        this.calls.push(input);
        if (this.failure !== null) throw this.failure;
        return this.output;
    }
}

/** 레시피 슬라이스가 나눠 든 세 포트를 한 객체로 구현한 대역이며, 실물이 잡 원장과 설정 표와 추적 API를 각각 다른 어댑터로 들어 서로 다른 자원을 쓴다는 사실을 단순화한다. */
export class InMemoryRecipeRepository
implements RecipeJobLedgerPort, RecipeSettingReaderPort, RecipeTaskReaderPort {
    readonly settings = new Map<string, string>();
    readonly settingReads: { readonly scope: string; readonly key: string }[] = [];
    readonly anchors = new Map<string, RecipeAnchorSnapshot>();
    readonly ownedTaskIds = new Set<string>();
    readonly failedAttempts: RecipeFailedAttempt[] = [];
    readonly commits: RecipeScanCommit[] = [];
    readonly failures: { readonly jobId: string; readonly message: string }[] = [];
    started: string[] = [];
    startWins = true;
    commitWins = true;
    private job: RecipeJobSnapshot | null = null;

    seedJob(job: RecipeJobSnapshot): void {
        this.job = job;
    }

    async findJob(jobId: string): Promise<RecipeJobSnapshot | null> {
        return this.job !== null && this.job.id === jobId ? this.job : null;
    }

    async startJob(jobId: string): Promise<boolean> {
        if (!this.startWins) return false;
        this.started.push(jobId);
        return true;
    }

    async findAnchor(_userId: string, taskId: string): Promise<RecipeAnchorSnapshot | null> {
        return this.anchors.get(taskId) ?? null;
    }

    async findValue(scope: string, key: string): Promise<string | null> {
        this.settingReads.push({ scope, key });
        return this.settings.get(key) ?? null;
    }

    async findOwnedTaskIds(_userId: string, taskIds: readonly string[]): Promise<readonly string[]> {
        return taskIds.filter((taskId) => this.ownedTaskIds.has(taskId));
    }

    async recordFailedAttempt(input: RecipeFailedAttempt): Promise<void> {
        this.failedAttempts.push(input);
    }

    async readSuccessAttemptUsage(
        _jobId: string,
        record: JobAttemptRecord,
    ): Promise<{
        readonly attempts: readonly JobAttemptRecord[] | undefined;
        readonly costUsd: number | null;
    }> {
        const { attempts, totalCostUsd } = foldAttempt(this.job?.usage ?? {}, record);
        if (attempts.length <= 1) return { attempts: undefined, costUsd: record.costUsd };
        return { attempts, costUsd: totalCostUsd ?? record.costUsd };
    }

    async commitScan(input: RecipeScanCommit): Promise<{ readonly candidatesCreated: number } | null> {
        if (!this.commitWins) return null;
        this.commits.push(input);
        return { candidatesCreated: input.recipes.length };
    }

    async failJob(jobId: string, message: string): Promise<RecipeJobSnapshot | null> {
        if (this.job === null || this.job.id !== jobId) return null;
        this.failures.push({ jobId, message });
        return this.job;
    }
}

/** 산출물 창구를 메모리로 구현한 테스트 대역이며 같은 실행 식별자를 두 번 받으면 앞의 수를 낸다. */
export class InMemoryRecipeOutput implements RecipeOutputPort {
    readonly batches: RecipeCandidateBatch[] = [];
    failure: Error | null = null;
    private readonly createdByJob = new Map<string, number>();

    async createCandidates(batch: RecipeCandidateBatch): Promise<number> {
        if (this.failure !== null) throw this.failure;
        const seen = this.createdByJob.get(batch.sourceJobId);
        if (seen !== undefined) return seen;
        this.batches.push(batch);
        this.createdByJob.set(batch.sourceJobId, batch.recipes.length);
        return batch.recipes.length;
    }
}

export function recipeIds(): SequentialRecipeIdGenerator {
    return new SequentialRecipeIdGenerator();
}

export function seedRepository(): InMemoryRecipeRepository {
    const repository = new InMemoryRecipeRepository();
    repository.seedJob({ id: "job-1", userId: "user-1", taskId: "task-1", usage: {} });
    repository.settings.set(RECIPE_SETTING_KEY.anthropicApiKey, "sk-test");
    repository.anchors.set("task-1", {
        scanEligible: true,
        sessionScanEligible: true,
    });
    return repository;
}

export function recipeObservation(overrides: Partial<AgentRunObservation> = {}): AgentRunObservation {
    return {
        executionId: "job-1",
        attemptId: "1",
        jobId: "job-1",
        agentName: "recipe-scan",
        backend: AGENT_BACKEND,
        modelRequested: "claude-haiku-4-5",
        modelActual: "claude-haiku-4-5",
        promptVersion: "v0.0.1",
        toolContractVersion: "v0.0.1",
        status: "succeeded",
        durationMs: 1_200,
        ttftMs: null,
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
    overrides: Partial<GenerateRecipeCandidatesOutput> = {},
): GenerateRecipeCandidatesOutput {
    return {
        recipes: [],
        modelUsed: "claude-haiku-4-5",
        durationMs: 1_200,
        costUsd: 0.01,
        numTurns: 2,
        usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0 },
        steps: [],
        provenance: { eventIdsByTask: {}, turnIdsByTask: {}, ruleIds: [], recipeRevs: {} },
        observation: recipeObservation(),
        ...overrides,
    };
}

export function attemptRun(
    attempt = 1,
): { attempt: number; idempotencyKey: string; abortSignal: AbortSignal } {
    return { attempt, idempotencyKey: "wf-1-act-1", abortSignal: new AbortController().signal };
}
