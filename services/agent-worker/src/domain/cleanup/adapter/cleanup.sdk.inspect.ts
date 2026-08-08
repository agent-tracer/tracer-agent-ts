import type { JobStepPayload } from "@tracer-agent/llm";
import { AgentExecutionFailure, lastStructuredAttempt } from "@tracer-agent/llm";
import { validationFailedStep } from "~agent-worker/support/llm/run.segment.js";
import { type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
import { agentFailureAccounting, type AgentCallAccounting } from "~agent-worker/support/llm/agent.accounting.js";
import {
    buildCleanupInspectPrompt,
    buildCleanupInspectSystemPrompt,
} from "~agent-worker/domain/cleanup/model/cleanup.prompt.js";
import {
    inspectReportSchema,
    salvageInspectReport,
    type InspectAssignment,
    type InspectReport,
} from "~agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import {
    buildInspectFailureReport,
    CLEANUP_REVIEWER_MAX_TURNS,
    CLEANUP_REVIEWER_TOOLS,
} from "~agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";
import { CleanupProvenanceLedger } from "~agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import { buildCleanupToolHandlers, type CleanupToolBatch, type CleanupToolDeps } from "./cleanup.tools.js";
import {
    cleanupModelName,
    runCleanupQuery,
    TASK_CLEANUP_SPEC,
    type CleanupQueryContext,
} from "./cleanup.sdk.query.js";

const INSPECT_TOOL_NAMES = CLEANUP_REVIEWER_TOOLS;

/** 후보 하나를 자기 도구·자기 장부·자기 예산으로 조사한 결과다. */
export interface CleanupInspectRun {
    readonly report: InspectReport;
    readonly ledger: CleanupProvenanceLedger;
    readonly accounting: AgentCallAccounting;
    readonly steps: readonly JobStepPayload[];
}

/** 맡은 후보 하나를 이벤트 도구만으로 조사하며, 실패해도 예외 대신 실패 보고로 하향해 다른 후보의 조사를 지킨다. */
export async function runCleanupInspect(
    ctx: CleanupQueryContext,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    assignment: InspectAssignment,
    lease: AgentBudgetLease,
): Promise<CleanupInspectRun> {
    const ledger = new CleanupProvenanceLedger();
    const handlers = buildCleanupToolHandlers(ctx.input.userId, deps, batch, ledger);
    // 배정이 하나뿐이어도 계약이 정한 백스톱을 넘지 못하며, 모델이 읽는 수도 실제 상한과 같아야 한다.
    const capped = cappedLease(lease);

    try {
        const systemPrompt = buildCleanupInspectSystemPrompt(ctx.prompt);
        const run = await runCleanupQuery(ctx, {
            label: `${TASK_CLEANUP_SPEC.name}:inspect:${assignment.taskId}`,
            prompt: buildCleanupInspectPrompt(assignment.taskId, capped.maxTurns),
            systemPrompt,
            toolNames: INSPECT_TOOL_NAMES,
            handlers,
            outputSchema: inspectReportSchema,
            lease: capped,
        });
        return {
            report: run.data,
            ledger,
            accounting: { durationMs: run.durationMs, costUsd: run.costUsd, numTurns: run.numTurns, usage: run.usage },
            steps: run.steps,
        };
    } catch (error) {
        const steps = error instanceof AgentExecutionFailure ? error.steps : [];
        const salvaged = salvageInspectReport(assignment.taskId, lastStructuredAttempt(steps));
        return {
            report: salvaged ?? buildInspectFailureReport(assignment.taskId, error),
            ledger,
            accounting: agentFailureAccounting(error, cleanupModelName(ctx.input)),
            steps: salvaged === null ? steps : [...steps, salvageTrace(assignment)],
        };
    }
}

/**
 * 정산은 떼어 준 몫을 그대로 두고 실제 지출로 잔량을 되돌리므로, 조인 몫은 호출에만 쓰고
 * 원래 리스는 조율자가 그대로 정산한다.
 */
function cappedLease(lease: AgentBudgetLease): AgentBudgetLease {
    if (lease.maxTurns <= CLEANUP_REVIEWER_MAX_TURNS) return lease;
    return { ...lease, maxTurns: CLEANUP_REVIEWER_MAX_TURNS };
}

// 잘라 낸 보고와 처음부터 상한 안에 들어온 보고는 조율자에게 구분되지 않으므로 궤적에 남긴다.
function salvageTrace(assignment: InspectAssignment): JobStepPayload {
    return validationFailedStep(
        "inspect",
        `${assignment.taskId}: report exceeded its limits and was clamped to fit`,
    );
}

