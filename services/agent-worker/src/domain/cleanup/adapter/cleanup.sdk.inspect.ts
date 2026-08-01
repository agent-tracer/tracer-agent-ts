import type { JobStepPayload } from "@tracer-agent/llm";
import { AgentExecutionFailure, zodToClaudeOutputSchema } from "@tracer-agent/llm";
import { type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
import { type AgentCallAccounting } from "~agent-worker/support/llm/agent.accounting.js";
import {
    buildCleanupInspectPrompt,
    buildCleanupInspectSystemPrompt,
    CLEANUP_INSPECT_SYSTEM_TEMPLATE_KEY,
} from "~agent-worker/domain/cleanup/model/cleanup.prompt.js";
import { inspectReportSchema, type InspectAssignment, type InspectReport } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import { buildInspectFailureReport, CLEANUP_REVIEWER_TOOLS } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";
import { CleanupProvenanceLedger } from "~agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import { TASK_CLEANUP_TOOLS } from "~agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import { buildCleanupToolHandlers, type CleanupToolBatch, type CleanupToolDeps } from "./cleanup.tools.js";
import { runCleanupQuery, TASK_CLEANUP_SPEC, type CleanupQueryContext } from "./cleanup.sdk.query.js";

const INSPECT_TOOL_NAMES = CLEANUP_REVIEWER_TOOLS;
const INSPECT_TOOL_SPECS = TASK_CLEANUP_TOOLS.filter((spec) =>
    (CLEANUP_REVIEWER_TOOLS as readonly string[]).includes(spec.name));

/** 후보 하나를 자기 도구·자기 장부·자기 예산으로 조사한 결과다. */
export interface CleanupInspectRun {
    readonly report: InspectReport;
    readonly ledger: CleanupProvenanceLedger;
    readonly accounting: AgentCallAccounting;
    readonly steps: readonly JobStepPayload[];
}

/** 맡은 후보 하나를 이벤트 도구만으로 조사하며, 무너져도 예외 대신 실패 보고로 강등해 다른 후보의 조사를 지킨다. */
export async function runCleanupInspect(
    ctx: CleanupQueryContext,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    assignment: InspectAssignment,
    lease: AgentBudgetLease,
): Promise<CleanupInspectRun> {
    const ledger = new CleanupProvenanceLedger();
    const handlers = buildCleanupToolHandlers(ctx.input.userId, deps, batch, ledger);

    try {
        const systemPrompt = buildCleanupInspectSystemPrompt(ctx.prompt);
        ctx.resolvedTemplates.set(CLEANUP_INSPECT_SYSTEM_TEMPLATE_KEY, systemPrompt);
        const run = await runCleanupQuery(ctx, {
            label: `${TASK_CLEANUP_SPEC.name}:inspect:${assignment.taskId}`,
            prompt: buildCleanupInspectPrompt(assignment.taskId, lease.maxTurns),
            systemPrompt,
            toolNames: INSPECT_TOOL_NAMES,
            toolSpecs: INSPECT_TOOL_SPECS,
            handlers,
            outputSchema: inspectReportSchema,
            claudeOutputSchema: zodToClaudeOutputSchema(inspectReportSchema),
            lease,
        });
        return {
            report: run.data,
            ledger,
            accounting: { durationMs: run.durationMs, costUsd: run.costUsd, numTurns: run.numTurns, usage: run.usage },
            steps: run.steps,
        };
    } catch (error) {
        return {
            report: buildInspectFailureReport(assignment.taskId, error),
            ledger,
            accounting: agentFailureAccounting(error),
            steps: error instanceof AgentExecutionFailure ? error.steps : [],
        };
    }
}

// 무너진 호출의 실제 지출은 알 수 없으므로 settle()의 null 처리가 예약해 준 몫을 전부 쓴 것으로
// 보수적으로 간주하도록 costUsd와 numTurns를 비워 둔다.
export function agentFailureAccounting(error: unknown): AgentCallAccounting {
    return {
        durationMs: error instanceof AgentExecutionFailure ? (error.durationMs ?? 0) : 0,
        costUsd: null,
        numTurns: null,
        usage: error instanceof AgentExecutionFailure ? error.usage : null,
    };
}
