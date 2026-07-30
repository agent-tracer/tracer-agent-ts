import type { AgentRunObservation, PromptIntegrityContract, ResolvedAgentPrompt, ResolvedPromptFragment } from "@tracer-agent/llm";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import { normalizeOutputLanguage, OUTPUT_LANGUAGE } from "~agent-worker/support/output.language.js";
import { PromptFragmentRunResolver } from "~agent-worker/support/resolved.prompt.fragments.js";
import { EvaluationMissingApiKeyError } from "~agent-worker/domain/evaluation/model/evaluation.error.js";
import {
    readOptionalIntField,
    readOptionalStringField,
    requireStringField,
} from "~agent-worker/domain/evaluation/model/evaluation.input.model.js";
import { clampInt } from "~agent-worker/support/clamp.js";
import type { EvaluationRunEnvelope, EvaluationRunResult } from "~agent-worker/domain/evaluation/model/evaluation.envelope.model.js";
import type { EvaluationDispatchContext } from "~agent-worker/domain/evaluation/port/evaluation.agent.port.js";
import {
    buildSnapshotCleanupEvents,
    buildSnapshotRecipeDeps,
    buildSnapshotTitleEvents,
} from "~agent-worker/domain/evaluation/adapter/evaluation.snapshot.tool.deps.js";
import type { SnapshotRecipeSearch, SnapshotRuleReader, SnapshotTaskAndEventReader } from "~agent-worker/domain/evaluation/adapter/snapshot.readers.js";

/** cleanup.suggestion.schema.ts의 CLEANUP_MAX_SUGGESTIONS를 그대로 따르는 상한이며, 형제 슬라이스를 import할 수 없어 값만 옮겨 고정한다. */
const CLEANUP_MAX_SUGGESTIONS_CAP = 50;
const DEFAULT_CLEANUP_MAX_SUGGESTIONS = 20;
/** get_task_events 핸들러는 소유권 확인으로 findById를 부르지만 반환값의 id는 그 확인 이후로 쓰이지 않으므로, 어떤 후보를 열어도 통과하는 placeholder taskId로 스냅샷 리더를 하나만 둔다. */
const CANDIDATE_SCOPE_PLACEHOLDER = "cleanup-candidate";

/** title.agent.adapter가 실제로 채우는 generate() 결과이며, title 슬라이스를 import하지 않도록 이 슬라이스가 구조만 다시 선언한다. */
export interface EvaluationTitleAgentOutput {
    readonly suggestions: readonly unknown[];
    readonly observation: AgentRunObservation;
}

/** title.agent.adapter의 생성 표면이며 실제 구현은 조립 근원이 주입한다. */
export interface EvaluationTitleAgent {
    requiresLocalApiKey(): boolean;
    generate(input: {
        readonly jobId: string;
        readonly userId: string;
        readonly taskId: string;
        readonly language: OutputLanguage;
        readonly context: {
            readonly title: string;
            readonly status: string;
            readonly totalEventCount: number;
            readonly totalTurnCount: number;
            readonly truncated: boolean;
            readonly turns: readonly unknown[];
        };
        readonly prompt: ResolvedAgentPrompt;
        readonly attempt: number;
        readonly apiKey?: string;
        readonly model?: string;
        readonly idempotencyKey?: string;
        readonly abortSignal?: AbortSignal;
    }): Promise<EvaluationTitleAgentOutput>;
}

/** title 에이전트 인스턴스 하나를 그 실행이 쓸 스냅샷 이벤트 조회 표면과 프롬프트 조각 해석기로 만드는 조립 근원의 표면이다. */
export type EvaluationTitleAgentFactory = (
    events: SnapshotTaskAndEventReader,
    resolveFragments?: () => PromptFragmentRunResolver,
) => EvaluationTitleAgent;

/** recipe.agent.adapter가 실제로 채우는 generate() 결과이며, recipe 슬라이스를 import하지 않도록 이 슬라이스가 구조만 다시 선언한다. */
export interface EvaluationRecipeAgentOutput {
    readonly recipes: readonly unknown[];
    readonly observation: AgentRunObservation;
}

/** recipe.agent.adapter의 생성 표면이며 실제 구현은 조립 근원이 주입한다. */
export interface EvaluationRecipeAgent {
    requiresLocalApiKey(): boolean;
    generate(input: {
        readonly prompt: ResolvedAgentPrompt;
        readonly jobId: string;
        readonly userId: string;
        readonly taskId: string;
        readonly language: OutputLanguage;
        readonly attempt: number;
        readonly apiKey?: string;
        readonly model?: string;
        readonly userPrompt?: string;
        readonly idempotencyKey?: string;
        readonly abortSignal?: AbortSignal;
    }): Promise<EvaluationRecipeAgentOutput>;
}

export interface EvaluationRecipeSnapshotDeps {
    readonly tasks: SnapshotTaskAndEventReader;
    readonly events: SnapshotTaskAndEventReader;
    readonly rules: SnapshotRuleReader;
    readonly search: SnapshotRecipeSearch;
}

/** recipe 에이전트 인스턴스 하나를 그 실행이 쓸 스냅샷 도구 의존과 프롬프트 조각 해석기로 만드는 조립 근원의 표면이다. */
export type EvaluationRecipeAgentFactory = (
    deps: EvaluationRecipeSnapshotDeps,
    resolveFragments?: () => PromptFragmentRunResolver,
) => EvaluationRecipeAgent;

/** cleanup.agent.adapter가 실제로 채우는 generate() 결과이며, cleanup 슬라이스를 import하지 않도록 이 슬라이스가 구조만 다시 선언한다. */
export interface EvaluationCleanupAgentOutput {
    readonly suggestions: readonly unknown[];
    readonly observation: AgentRunObservation;
}

/** cleanup.agent.adapter의 생성 표면이며 실제 구현은 조립 근원이 주입한다. */
export interface EvaluationCleanupAgent {
    requiresLocalApiKey(): boolean;
    generate(input: {
        readonly prompt: ResolvedAgentPrompt;
        readonly jobId: string;
        readonly userId: string;
        readonly language: OutputLanguage;
        readonly scannedAt: string;
        readonly candidates: readonly unknown[];
        readonly truncated: boolean;
        readonly maxSuggestions: number;
        readonly attempt: number;
        readonly apiKey?: string;
        readonly model?: string;
        readonly idempotencyKey?: string;
        readonly abortSignal?: AbortSignal;
    }): Promise<EvaluationCleanupAgentOutput>;
}

/** cleanup 에이전트 인스턴스 하나를 그 실행이 쓸 스냅샷 이벤트 조회 표면과 프롬프트 조각 해석기로 만드는 조립 근원의 표면이다. */
export type EvaluationCleanupAgentFactory = (
    events: SnapshotTaskAndEventReader,
    resolveFragments?: () => PromptFragmentRunResolver,
) => EvaluationCleanupAgent;

function isFragmentIntegrity(value: PromptIntegrityContract | undefined): value is Extract<PromptIntegrityContract, { readonly mode: "resolved-fragments" | "fragment-content-only" }> {
    return value?.mode === "resolved-fragments" || value?.mode === "fragment-content-only";
}

function withRunLinks(envelope: EvaluationRunEnvelope, observation: AgentRunObservation): AgentRunObservation {
    return {
        ...observation,
        experimentId: envelope.experimentId,
        exampleId: envelope.exampleId,
        variantId: envelope.variantId,
    };
}

function resolverFor(
    templateKeyPrefix: string,
    envelope: EvaluationRunEnvelope,
    operationalFragments: readonly ResolvedPromptFragment[],
): (() => PromptFragmentRunResolver) | undefined {
    const integrity = envelope.promptIntegrity;
    const operational = operationalFragments.filter(({ templateKey }) => templateKey.startsWith(templateKeyPrefix));
    if (!isFragmentIntegrity(integrity) && operational.some(({ source }) => source === "database-override")) {
        throw new Error("prompt-fragment.override-requires-resolved-integrity");
    }
    const fragments = isFragmentIntegrity(integrity) ? integrity.fragments : operational;
    const expected = integrity?.mode === "resolved-fragments"
        ? { resolvedPromptHash: integrity.resolvedPromptHash, resolvedPromptHashes: integrity.resolvedPromptHashes }
        : undefined;
    return isFragmentIntegrity(integrity) ? () => new PromptFragmentRunResolver(fragments, expected) : undefined;
}

/** title-suggestion example를 도구만 evidence 스냅샷으로 바꿔 조립 근원이 주입한 실제 에이전트로 돌린다. */
export async function runTitleEvaluation(
    createAgent: EvaluationTitleAgentFactory,
    envelope: EvaluationRunEnvelope,
    ctx: EvaluationDispatchContext,
    operationalFragments: readonly ResolvedPromptFragment[],
): Promise<EvaluationRunResult> {
    const taskId = requireStringField(envelope.input, "taskId");
    const userId = envelope.experimentId;
    const agent = createAgent(buildSnapshotTitleEvents(envelope.evidence, taskId), resolverFor("title-suggestion.", envelope, operationalFragments));
    if (agent.requiresLocalApiKey() && envelope.apiKey === undefined) throw new EvaluationMissingApiKeyError();

    // example.input은 대화 발췌를 싣지 않으므로(계약: taskId만 필수) 컨텍스트를 얇게 시작해, 이미
    // get_task_events 경로를 안내하는 프롬프트를 따라 모델이 evidence를 직접 끌어오게 한다.
    const output = await agent.generate({
        jobId: ctx.runId,
        userId,
        taskId,
        language: OUTPUT_LANGUAGE.auto,
        context: { title: "", status: "unknown", totalEventCount: 0, totalTurnCount: 0, truncated: false, turns: [] },
        prompt: envelope.prompt,
        attempt: ctx.attempt,
        ...(envelope.apiKey !== undefined ? { apiKey: envelope.apiKey } : {}),
        ...(envelope.model !== undefined ? { model: envelope.model } : {}),
        ...(ctx.idempotencyKey !== undefined ? { idempotencyKey: ctx.idempotencyKey } : {}),
        ...(ctx.abortSignal !== undefined ? { abortSignal: ctx.abortSignal } : {}),
    });
    return {
        jobId: ctx.runId,
        output: { suggestions: output.suggestions },
        observation: withRunLinks(envelope, output.observation),
    };
}

/** recipe-scan example를 도구만 evidence 스냅샷으로 바꿔 조립 근원이 주입한 실제 에이전트로 돌린다. */
export async function runRecipeEvaluation(
    createAgent: EvaluationRecipeAgentFactory,
    envelope: EvaluationRunEnvelope,
    ctx: EvaluationDispatchContext,
    operationalFragments: readonly ResolvedPromptFragment[],
): Promise<EvaluationRunResult> {
    const taskId = requireStringField(envelope.input, "taskId");
    const userId = envelope.experimentId;
    const agent = createAgent(buildSnapshotRecipeDeps(envelope.evidence, taskId), resolverFor("recipe-scan.", envelope, operationalFragments));
    if (agent.requiresLocalApiKey() && envelope.apiKey === undefined) throw new EvaluationMissingApiKeyError();

    const language = normalizeOutputLanguage(readOptionalStringField(envelope.input, "language") ?? null);
    const userPrompt = readOptionalStringField(envelope.input, "userPrompt");
    const output = await agent.generate({
        jobId: ctx.runId,
        userId,
        taskId,
        language,
        prompt: envelope.prompt,
        attempt: ctx.attempt,
        ...(envelope.apiKey !== undefined ? { apiKey: envelope.apiKey } : {}),
        ...(envelope.model !== undefined ? { model: envelope.model } : {}),
        ...(userPrompt !== undefined ? { userPrompt } : {}),
        ...(ctx.idempotencyKey !== undefined ? { idempotencyKey: ctx.idempotencyKey } : {}),
        ...(ctx.abortSignal !== undefined ? { abortSignal: ctx.abortSignal } : {}),
    });
    return {
        jobId: ctx.runId,
        output: { recipes: output.recipes },
        observation: withRunLinks(envelope, output.observation),
    };
}

/** task-cleanup example를 후보 배치와 도구 모두 evidence 스냅샷으로 바꿔 조립 근원이 주입한 실제 에이전트로 돌린다. */
export async function runCleanupEvaluation(
    createAgent: EvaluationCleanupAgentFactory,
    envelope: EvaluationRunEnvelope,
    ctx: EvaluationDispatchContext,
    operationalFragments: readonly ResolvedPromptFragment[],
): Promise<EvaluationRunResult> {
    const userId = envelope.experimentId;
    const events = buildSnapshotCleanupEvents(envelope.evidence, CANDIDATE_SCOPE_PLACEHOLDER);
    const agent = createAgent(events, resolverFor("task-cleanup.", envelope, operationalFragments));
    if (agent.requiresLocalApiKey() && envelope.apiKey === undefined) throw new EvaluationMissingApiKeyError();

    const candidates = readEvidenceArrayField(envelope.evidence, "list_candidate_tasks");
    const maxSuggestions = clampInt(
        readOptionalIntField(envelope.input, "maxSuggestions"),
        DEFAULT_CLEANUP_MAX_SUGGESTIONS,
        1,
        CLEANUP_MAX_SUGGESTIONS_CAP,
    );
    const output = await agent.generate({
        jobId: ctx.runId,
        userId,
        language: OUTPUT_LANGUAGE.auto,
        prompt: envelope.prompt,
        scannedAt: new Date().toISOString(),
        candidates,
        truncated: false,
        maxSuggestions,
        attempt: ctx.attempt,
        ...(envelope.apiKey !== undefined ? { apiKey: envelope.apiKey } : {}),
        ...(envelope.model !== undefined ? { model: envelope.model } : {}),
        ...(ctx.idempotencyKey !== undefined ? { idempotencyKey: ctx.idempotencyKey } : {}),
        ...(ctx.abortSignal !== undefined ? { abortSignal: ctx.abortSignal } : {}),
    });
    return {
        jobId: ctx.runId,
        output: { suggestions: output.suggestions },
        observation: withRunLinks(envelope, output.observation),
    };
}

function readEvidenceArrayField(evidence: Record<string, unknown>, key: string): readonly unknown[] {
    const value = evidence[key];
    return Array.isArray(value) ? value : [];
}
