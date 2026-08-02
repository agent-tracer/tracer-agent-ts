import {
  buildMcpToolServer,
  type ClaudeQueryOptions,
  type IQueryRunner,
  type OutputSchema,
  type ToolHandlers,
  mcpToolNames,
  withMcpToolPrefix,
  runStructuredQuery,
    type StructuredQueryResult,
    featureLimits,
    featureModels,
    modelMaxOutputTokens,
    type LlmToolDefinition,
} from "@tracer-agent/llm";
import { type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { RECIPE_FEATURE } from "~agent-worker/domain/recipe/model/recipe.const.js";
import { RECIPE_SCAN_FAILURES } from "~agent-worker/domain/recipe/model/recipe.tool.schema.js";
import type { GenerateRecipeCandidatesInput } from "~agent-worker/domain/recipe/port/recipe.agent.port.js";
import type { AgentPrompt } from "~agent-worker/support/agent.prompt.js";

const RECIPE_MODELS = featureModels(RECIPE_FEATURE)!;
const RECIPE_LIMITS = featureLimits(RECIPE_FEATURE);

export const RECIPE_SCAN_SPEC = {
    name: AGENT.recipeScan.id,
    failures: RECIPE_SCAN_FAILURES,
    limits: {
        defaultModel: RECIPE_MODELS.default,
        fallbackModel: RECIPE_MODELS.fallback ?? RECIPE_MODELS.default,
        maxTurns: RECIPE_LIMITS.maxTurns,
        deadlineMs: RECIPE_LIMITS.deadlineMs,
        maxOutputTokens: RECIPE_LIMITS.maxOutputTokens,
        maxBudgetUsd: RECIPE_LIMITS.budgetUsd,
        effort: RECIPE_LIMITS.effort,
    },
} as const;

export const RECIPE_MCP_SERVER = `monitor-${RECIPE_SCAN_SPEC.name}`;

/** recipe-scan의 각 호출이 공유하는 실행 입력이다. */
export interface RecipeQueryContext {
  readonly runner: IQueryRunner<ClaudeQueryOptions>;
  readonly input: GenerateRecipeCandidatesInput;
  readonly prompt: AgentPrompt;
}

export interface RecipeQuerySpec<T> {
  readonly label: string;
  readonly prompt: string;
  readonly systemPrompt: string;
  readonly toolNames: readonly string[];
  readonly toolSpecs: readonly LlmToolDefinition[];
  readonly handlers: ToolHandlers;
  readonly outputSchema: OutputSchema<T>;
  /** 호출부가 자기 zod 스키마로 미리 만들어 건네는, Claude 구조화 출력용 JSON 스키마다. */
  readonly claudeOutputSchema: Record<string, unknown>;
  readonly lease: AgentBudgetLease;
}

/** 이 실행이 부를 모델 이름이며, 요청이 모델을 지정하지 않으면 명세의 기본 모델이다. */
export function recipeModelName(input: GenerateRecipeCandidatesInput): string {
  return input.model?.trim() || RECIPE_SCAN_SPEC.limits.defaultModel;
}

/** recipe-scan 호출 하나가 공통으로 거치는 모델·예산·MCP 배선을 한 곳에 모은다. */
export function runRecipeQuery<T>(
  ctx: RecipeQueryContext,
  spec: RecipeQuerySpec<T>,
): Promise<StructuredQueryResult<T>> {
  const { limits } = RECIPE_SCAN_SPEC;
  const model = recipeModelName(ctx.input);
  const allowedTools = mcpToolNames(RECIPE_MCP_SERVER, spec.toolNames);

  return runStructuredQuery(
    ctx.runner,
    {
      label: spec.label,
      prompt: withMcpToolPrefix(spec.prompt, spec.toolNames, RECIPE_MCP_SERVER),
      systemPrompt: withMcpToolPrefix(
        spec.systemPrompt,
        spec.toolNames,
        RECIPE_MCP_SERVER,
      ),
      allowedTools,
      jobId: ctx.input.jobId,
      observation: {
        executionId: ctx.input.jobId,
        attemptId: String(ctx.input.attempt),
      },
      model,
      maxTurns: spec.lease.maxTurns,
      maxOutputTokens: modelMaxOutputTokens(RECIPE_FEATURE, model),
      deadlineMs: limits.deadlineMs,
      // Agent SDK 하위 프로세스의 활동을 사용자 태스크와 구분하도록 출처를 표시한다.
      env: {
        MONITOR_TASK_TITLE: `Agent · ${spec.label}`,
        MONITOR_TASK_ORIGIN: "server-sdk",
        ...(ctx.input.apiKey !== undefined
          ? { ANTHROPIC_API_KEY: ctx.input.apiKey }
          : {}),
      },
      outputSchema: spec.claudeOutputSchema,
      ...(limits.effort !== undefined ? { effort: limits.effort } : {}),
      ...(spec.lease.maxBudgetUsd !== undefined
        ? { maxBudgetUsd: spec.lease.maxBudgetUsd }
        : {}),
      providerOptions: {
        ...(model !== limits.fallbackModel
          ? { fallbackModel: limits.fallbackModel }
          : {}),
        mcpServers: {
          [RECIPE_MCP_SERVER]: buildMcpToolServer(
            RECIPE_MCP_SERVER,
            spec.toolSpecs,
            spec.handlers,
            RECIPE_SCAN_SPEC.failures,
          ),
        },
      },
      ...(ctx.input.idempotencyKey !== undefined
        ? { idempotencyKey: ctx.input.idempotencyKey }
        : {}),
      ...(ctx.input.abortSignal !== undefined
        ? { parentSignal: ctx.input.abortSignal }
        : {}),
    },
    spec.outputSchema,
  );
}
