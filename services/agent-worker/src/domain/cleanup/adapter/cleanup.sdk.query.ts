import {
    buildMcpToolServer,
    featureLimits,
    featureModels,
    mcpToolNames,
    runStructuredQuery,
    withMcpToolPrefix,
    zodToClaudeOutputSchema,
    type StructuredSchema,
    type ClaudeQueryOptions,
    type IQueryRunner,
    type StructuredQueryResult,
    type ToolHandlers,
} from "@tracer-agent/llm";
import {
    TASK_CLEANUP_TOOLS,
    type TaskCleanupToolName,
} from "~agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
import type { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { CLEANUP_FEATURE } from "~agent-worker/domain/cleanup/model/cleanup.const.js";
import { TASK_CLEANUP_FAILURES } from "~agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import type { GenerateCleanupSuggestionsInput } from "~agent-worker/domain/cleanup/port/cleanup.agent.port.js";

const CLEANUP_MODELS = featureModels(CLEANUP_FEATURE)!;
const CLEANUP_LIMITS = featureLimits(CLEANUP_FEATURE);

export const TASK_CLEANUP_SPEC = {
    name: AGENT.taskCleanup.id,
    failures: TASK_CLEANUP_FAILURES,
    limits: {
        defaultModel: CLEANUP_MODELS.default,
        fallbackModel: CLEANUP_MODELS.fallback ?? CLEANUP_MODELS.default,
        maxTurns: CLEANUP_LIMITS.maxTurns,
        deadlineMs: CLEANUP_LIMITS.deadlineMs,
        maxOutputTokens: CLEANUP_LIMITS.maxOutputTokens,
        maxBudgetUsd: CLEANUP_LIMITS.budgetUsd,
        effort: "medium",
    },
} as const;

export const CLEANUP_MCP_SERVER = `monitor-${TASK_CLEANUP_SPEC.name}`;

/** task-cleanup의 각 호출이 공유하는 실행 입력이다. */
export interface CleanupQueryContext {
    readonly runner: IQueryRunner<ClaudeQueryOptions>;
    readonly input: GenerateCleanupSuggestionsInput;
    readonly prompt: AgentPrompt;
}

export interface CleanupQuerySpec<T, Name extends TaskCleanupToolName = TaskCleanupToolName> {
    readonly label: string;
    readonly prompt: string;
    readonly systemPrompt: string;
    readonly toolNames: readonly Name[];
    readonly handlers: ToolHandlers<Name>;
    /** 모델이 볼 JSON Schema와 결과를 검증할 파서가 이 하나에서 함께 나온다. */
    readonly outputSchema: StructuredSchema<T>;
    readonly lease: AgentBudgetLease;
}

/** 이 실행이 부를 모델 이름이며, 요청이 모델을 지정하지 않으면 명세의 기본 모델이다. */
export function cleanupModelName(input: GenerateCleanupSuggestionsInput): string {
    return input.model?.trim() || TASK_CLEANUP_SPEC.limits.defaultModel;
}

/** task-cleanup 호출 하나가 공통으로 거치는 모델·예산·MCP 배선을 한 곳에 모은다. */
export function runCleanupQuery<T, Name extends TaskCleanupToolName>(
    ctx: CleanupQueryContext,
    spec: CleanupQuerySpec<T, Name>,
): Promise<StructuredQueryResult<T>> {
    const { limits } = TASK_CLEANUP_SPEC;
    const model = cleanupModelName(ctx.input);
    const allowedTools = mcpToolNames(CLEANUP_MCP_SERVER, spec.toolNames);
    const opened = new Set<string>(spec.toolNames);
    const toolSpecs = TASK_CLEANUP_TOOLS.filter((one) => opened.has(one.name));

    return runStructuredQuery(
        ctx.runner,
        {
            label: spec.label,
            prompt: withMcpToolPrefix(spec.prompt, spec.toolNames, CLEANUP_MCP_SERVER),
            systemPrompt: withMcpToolPrefix(spec.systemPrompt, spec.toolNames, CLEANUP_MCP_SERVER),
            allowedTools,
            jobId: ctx.input.jobId,
            observation: { executionId: ctx.input.jobId, attemptId: String(ctx.input.attempt) },
            model,
            maxTurns: spec.lease.maxTurns,
            maxOutputTokens: limits.maxOutputTokens,
            deadlineMs: limits.deadlineMs,
            // Agent SDK 하위 프로세스의 활동도 수집되므로 사용자 태스크와 구분되도록 출처를 표시한다.
            env: {
                MONITOR_TASK_TITLE: `Agent · ${spec.label}`,
                MONITOR_TASK_ORIGIN: "server-sdk",
                ...(ctx.input.apiKey !== undefined ? { ANTHROPIC_API_KEY: ctx.input.apiKey } : {}),
            },
            outputSchema: zodToClaudeOutputSchema(spec.outputSchema),
            effort: limits.effort,
            ...(spec.lease.maxBudgetUsd !== undefined ? { maxBudgetUsd: spec.lease.maxBudgetUsd } : {}),
            providerOptions: {
                ...(model !== limits.fallbackModel ? { fallbackModel: limits.fallbackModel } : {}),
                // 도구 없이 도는 호출(조율자)에는 MCP 서버 자체를 세우지 않아 열지 않기로 한 도구가 새어 나갈 자리를 없앤다.
                ...(toolSpecs.length > 0
                    ? {
                        mcpServers: {
                            [CLEANUP_MCP_SERVER]: buildMcpToolServer(
                                CLEANUP_MCP_SERVER,
                                toolSpecs,
                                spec.handlers,
                                TASK_CLEANUP_SPEC.failures,
                            ),
                        },
                    }
                    : {}),
            },
            ...(ctx.input.idempotencyKey !== undefined ? { idempotencyKey: ctx.input.idempotencyKey } : {}),
            ...(ctx.input.abortSignal !== undefined ? { parentSignal: ctx.input.abortSignal } : {}),
        },
        spec.outputSchema,
    );
}
