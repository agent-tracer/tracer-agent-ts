import type { JobStepPayload } from "@tracer-agent/llm";
import { AgentExecutionFailure } from "@tracer-agent/llm";
import { type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
import { agentFailureAccounting, type AgentCallAccounting } from "~agent-worker/support/llm/agent.accounting.js";
import {
    buildCleanupInspectPrompt,
    buildCleanupInspectSystemPrompt,
} from "~agent-worker/domain/cleanup/model/cleanup.prompt.js";
import { inspectReportSchema, type InspectAssignment, type InspectReport } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import { buildInspectFailureReport, CLEANUP_REVIEWER_TOOLS } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";
import { CleanupProvenanceLedger } from "~agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import { buildCleanupToolHandlers, type CleanupToolBatch, type CleanupToolDeps } from "./cleanup.tools.js";
import { runCleanupQuery, TASK_CLEANUP_SPEC, type CleanupQueryContext } from "./cleanup.sdk.query.js";

const INSPECT_TOOL_NAMES = CLEANUP_REVIEWER_TOOLS;

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
        const run = await runCleanupQuery(ctx, {
            label: `${TASK_CLEANUP_SPEC.name}:inspect:${assignment.taskId}`,
            prompt: buildCleanupInspectPrompt(assignment.taskId, lease.maxTurns),
            systemPrompt,
            toolNames: INSPECT_TOOL_NAMES,
            handlers,
            outputSchema: inspectReportSchema,
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

