import { AGENT_NODE, attemptedRepair } from "~agent-worker/support/llm/run.segment.js";
import {
    AGENT_BACKEND,
    buildMcpToolServer,
    isBudgetExhaustedFailure,
    mcpToolNames,
    mergeAgentTrajectory,
    runStructuredQuery,
    withInvokeAgentTelemetry,
    withMcpToolPrefix,
    zodToClaudeOutputSchema,
    type ClaudeQueryOptions,
    type IQueryRunner,
    type StructuredQueryResult,
} from "@tracer-agent/llm";
import { mergeAgentCallAccounting } from "~agent-worker/support/llm/agent.accounting.js";
import { ExecutionBudget, type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
import { buildSuccessfulRunObservation } from "~agent-worker/support/llm/run.observation.js";
import { TITLE_JOB_KIND } from "~agent-worker/domain/title/model/title.const.js";
import {
    buildTitleRepairPrompt,
    buildTitleSystemPrompt,
} from "~agent-worker/domain/title/model/title.prompt.js";
import { TITLE_SUGGESTION_SPEC } from "~agent-worker/domain/title/model/title.spec.js";
import type { TitleSuggestionsList } from "~agent-worker/domain/title/model/title.suggestion.schema.js";
import { TITLE_SUGGESTION_TOOL_NAMES } from "~agent-worker/domain/title/model/title.tool.schema.js";
import { validateTitleSuggestions } from "~agent-worker/domain/title/model/title.validation.model.js";
import type {
    GenerateTitleSuggestionsInput,
    GenerateTitleSuggestionsOutput,
    TitleAgentPort,
} from "~agent-worker/domain/title/port/title.agent.port.js";
import type { TitleEventReaderPort } from "~agent-worker/domain/title/port/title.event.reader.port.js";
import type { PromptSourcePort } from "~agent-worker/support/prompt.source.port.js";
import { buildTitleToolHandlers } from "./title.tools.js";

const MCP_SERVER = `monitor-${TITLE_SUGGESTION_SPEC.name}`;

// 첫 실행이 예산을 거의 다 써도 수리가 도구를 쥔 채 출력을 낼 최소 여지는 남긴다.
const REPAIR_RESERVED_TURNS = 1;
const REPAIR_RESERVED_BUDGET_SHARE = 0.2;

type StructuredRun = StructuredQueryResult<TitleSuggestionsList>;

interface RunSegment {
    readonly run: StructuredRun;
    readonly nodeName: string;
}

/** Claude Agent SDK 방언으로 제목 제안 명세를 렌더링해 실행한다. */
export class TitleAgentAdapter implements TitleAgentPort {
    constructor(
        private readonly runner: IQueryRunner<ClaudeQueryOptions>,
        private readonly events: TitleEventReaderPort,
        private readonly prompts: PromptSourcePort,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.runner.requiresLocalApiKey();
    }

    generate(input: GenerateTitleSuggestionsInput): Promise<GenerateTitleSuggestionsOutput> {
        return withInvokeAgentTelemetry(
            {
                jobId: input.jobId,
                jobKind: TITLE_JOB_KIND,
                agentName: TITLE_SUGGESTION_SPEC.name,
                backend: AGENT_BACKEND,
                ...(input.model !== undefined ? { model: input.model } : {}),
            },
            () => this.runAgent(input),
        );
    }

    private async runAgent(
        input: GenerateTitleSuggestionsInput,
    ): Promise<GenerateTitleSuggestionsOutput> {
        const prompt = await this.prompts.resolve(TITLE_SUGGESTION_SPEC.name);
        const systemPrompt = buildTitleSystemPrompt(prompt, input.language);

        const handlers = buildTitleToolHandlers(input.userId, this.events);
        const basePrompt = TITLE_SUGGESTION_SPEC.userPrompt({
            taskId: input.taskId,
            language: input.language,
            context: input.context,
        });
        const { limits } = TITLE_SUGGESTION_SPEC;
        const budget = new ExecutionBudget({
            maxBudgetUsd: limits.maxBudgetUsd,
            maxTurns: limits.maxTurns,
        });

        // 수리 몫을 먼저 떼어 두어 첫 실행이 예산을 다 쓰더라도 수리가 도구를 가지고 출력을 낼 수 있다.
        const repairLease = budget.reserve(REPAIR_RESERVED_TURNS, REPAIR_RESERVED_BUDGET_SHARE);

        const firstLease = budget.lease(1);
        const first = await this.runOnce(input, handlers, basePrompt, firstLease, systemPrompt);
        budget.settle(firstLease, { costUsd: first.costUsd, numTurns: first.numTurns });
        const runs: RunSegment[] = [{ run: first, nodeName: AGENT_NODE.investigate }];

        const errors = validateTitleSuggestions(first.data.suggestions, input.context.title);
        if (errors.length === 0) return toOutput(input, runs, first.data.suggestions);

        // 예약된 몫마저 소진되 수리를 시도할 수 없으면 오류가 아닌 빈 결과로 종료한다.
        if (repairLease.maxTurns <= 0) return toOutput(input, runs, []);

        // 제목이 제약을 어기면 오류를 모델에게 돌려주고 예약해 둔 몫으로 한 번만 다시 받는다.
        let repaired: StructuredRun;
        try {
            repaired = await this.runOnce(
                input,
                handlers,
                buildTitleRepairPrompt(prompt, basePrompt, first.data, errors),
                repairLease,
                systemPrompt,
            );
        } catch (error) {
            // 예약해 둔 몫으로도 모델이 예산을 다 써버렸으면 잡을 실패시키지 않고 빈 결과로 종료한다.
            if (isBudgetExhaustedFailure(error)) return toOutput(input, runs, []);
            throw error;
        }
        budget.settle(repairLease, { costUsd: repaired.costUsd, numTurns: repaired.numTurns });
        runs.push({ run: repaired, nodeName: AGENT_NODE.repair });

        const remaining = validateTitleSuggestions(repaired.data.suggestions, input.context.title);
        return toOutput(input, runs, remaining.length === 0 ? repaired.data.suggestions : []);
    }

    private runOnce(
        input: GenerateTitleSuggestionsInput,
        handlers: ReturnType<typeof buildTitleToolHandlers>,
        prompt: string,
        lease: AgentBudgetLease,
        systemPrompt: string,
    ): Promise<StructuredRun> {
        const { limits } = TITLE_SUGGESTION_SPEC;
        const model = input.model?.trim() || limits.defaultModel;

        return runStructuredQuery(
            this.runner,
            {
                label: TITLE_SUGGESTION_SPEC.name,
                prompt: withMcpToolPrefix(prompt, TITLE_SUGGESTION_TOOL_NAMES, MCP_SERVER),
                systemPrompt: withMcpToolPrefix(systemPrompt, TITLE_SUGGESTION_TOOL_NAMES, MCP_SERVER),
                allowedTools: mcpToolNames(MCP_SERVER, TITLE_SUGGESTION_TOOL_NAMES),
                jobId: input.jobId,
                observation: { executionId: input.jobId, attemptId: String(input.attempt) },
                model,
                maxTurns: lease.maxTurns,
                maxOutputTokens: limits.maxOutputTokens,
                deadlineMs: limits.deadlineMs,
                // 하위 프로세스의 활동도 수집되므로 사용자 태스크와 구분되도록 출처를 표시한다.
                env: {
                    MONITOR_TASK_TITLE: `Agent · ${TITLE_SUGGESTION_SPEC.name}`,
                    MONITOR_TASK_ORIGIN: "server-sdk",
                    ...(input.apiKey !== undefined ? { ANTHROPIC_API_KEY: input.apiKey } : {}),
                },
                outputSchema: zodToClaudeOutputSchema(TITLE_SUGGESTION_SPEC.outputSchema),
                effort: limits.effort,
                ...(lease.maxBudgetUsd !== undefined ? { maxBudgetUsd: lease.maxBudgetUsd } : {}),
                providerOptions: {
                    ...(model !== limits.fallbackModel ? { fallbackModel: limits.fallbackModel } : {}),
                    mcpServers: {
                        [MCP_SERVER]: buildMcpToolServer(
                            MCP_SERVER,
                            TITLE_SUGGESTION_SPEC.tools,
                            handlers,
                            TITLE_SUGGESTION_SPEC.failures,
                        ),
                    },
                },
                ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
                ...(input.abortSignal !== undefined ? { parentSignal: input.abortSignal } : {}),
            },
            TITLE_SUGGESTION_SPEC.outputSchema,
        );
    }
}

function toOutput(
    input: GenerateTitleSuggestionsInput,
    runs: readonly RunSegment[],
    suggestions: GenerateTitleSuggestionsOutput["suggestions"],
): GenerateTitleSuggestionsOutput {
    const last = runs[runs.length - 1]!.run;
    const accounting = mergeAgentCallAccounting(runs.map(({ run }) => run));
    const steps = mergeAgentTrajectory(runs.map(({ run, nodeName }) => ({ nodeName, steps: run.steps })));
    const modelRequested = input.model?.trim() || TITLE_SUGGESTION_SPEC.limits.defaultModel;
    return {
        suggestions,
        modelUsed: last.modelUsed,
        durationMs: accounting.durationMs,
        costUsd: accounting.costUsd,
        numTurns: accounting.numTurns,
        usage: accounting.usage,
        steps,
        observation: buildSuccessfulRunObservation({
            executionId: input.jobId,
            attempt: input.attempt,
            jobId: input.jobId,
            agentName: TITLE_SUGGESTION_SPEC.name,
            modelRequested,
            modelActual: last.modelUsed,
            promptVersion: input.prompt.promptVersion,
            toolContractVersion: input.prompt.toolContractVersion,
            durationMs: accounting.durationMs,
            costUsd: accounting.costUsd,
            usage: accounting.usage,
            steps,
            landed: runs.some(({ run }) => run.landed),
            repairAttempted: attemptedRepair(runs),
            validationPassed: true,
        }),
    };
}
