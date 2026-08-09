import { AgentExecutionFailure, type StructuredQueryResult } from "@tracer-agent/llm";
import { logWarn } from "@tracer-agent/platform";
import type { AgentBudgetLease, ExecutionBudget } from "~agent-worker/support/llm/agent.budget.js";
import { agentFailureAccounting } from "~agent-worker/support/llm/agent.accounting.js";
import { AGENT_NODE, fanOutNode, type RunSegment } from "~agent-worker/support/llm/run.segment.js";
import { buildCleanupUserPrompt } from "~agent-worker/domain/cleanup/model/cleanup.prompt.js";
import type {
    InspectAssignment,
    InspectReport,
    TriagePlan,
} from "~agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import { inspectDepthShare } from "~agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import { CleanupProvenanceLedger } from "~agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import type { GenerateCleanupSuggestionsInput } from "~agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import type { CleanupToolBatch, CleanupToolDeps } from "./cleanup.tools.js";
import { cleanupModelName, type CleanupQueryContext } from "./cleanup.sdk.query.js";
import { runCleanupTriage } from "./cleanup.sdk.triage.js";
import { runCleanupInspect } from "./cleanup.sdk.inspect.js";
import { runCleanupDecision, type CleanupDecisionRun } from "./cleanup.sdk.investigate.js";

const EMPTY_PLAN: TriagePlan = { inspect: [] };

/** 한 태스크는 한 번만 조사하므로 모델이 같은 태스크를 겹쳐 내면 먼저 적은 것만 남긴다. */
export function oneInspectPerTask(
    assignments: readonly InspectAssignment[],
): readonly InspectAssignment[] {
    const seen = new Set<string>();
    const kept: InspectAssignment[] = [];
    for (const assignment of assignments) {
        if (seen.has(assignment.taskId)) {
            logWarn({ msg: "cleanup.task.duplicated", taskId: assignment.taskId });
            continue;
        }
        seen.add(assignment.taskId);
        kept.push(assignment);
    }
    return kept;
}

/** 선별 단계의 결과이며 demoted 는 호출이 실패해 빈 계획으로 낮춘 실행인지를 구분한다. */
export interface CleanupTriagePhase {
    readonly plan: TriagePlan;
    readonly ledger: CleanupProvenanceLedger;
    readonly demoted: boolean;
}

/** 선별이 후보 목록 도구만 가지고 무엇을 조사할지 정하며, 호출이 실패하면 아무도 조회하지 않는 빈 계획으로 대체한다. */
export async function runCleanupTriagePhase(
    ctx: CleanupQueryContext,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    budget: ExecutionBudget,
    lease: AgentBudgetLease,
    segments: RunSegment[],
): Promise<CleanupTriagePhase> {
    if (lease.maxTurns <= 0) {
        // 예약 몫이 0이면 선별을 부르지 못한 것이므로 빈 계획을 실패로 낮춘 실행으로 읽지 않는다.
        return { plan: EMPTY_PLAN, ledger: new CleanupProvenanceLedger(), demoted: false };
    }
    try {
        const { result, ledger } = await runCleanupTriage(ctx, deps, batch, lease);
        budget.settle(lease, { costUsd: result.costUsd, numTurns: result.numTurns });
        segments.push(toRunSegment(result, AGENT_NODE.triage));
        return { plan: result.data, ledger, demoted: false };
    } catch (error) {
        const accounting = agentFailureAccounting(error, cleanupModelName(ctx.input));
        budget.settle(lease, { costUsd: accounting.costUsd, numTurns: accounting.numTurns });
        // 계약이 낮춘 사실을 궤적에 남기라 하므로 실패한 호출의 부분 궤적을 버리지 않는다.
        const steps = error instanceof AgentExecutionFailure ? error.steps : [];
        segments.push({ accounting, steps, nodeName: AGENT_NODE.triage });
        return { plan: EMPTY_PLAN, ledger: new CleanupProvenanceLedger(), demoted: true };
    }
}

/** 계획대로 후보를 병렬로 조회하고, 보고가 모이면 장부를 조율자 장부로 합친다. */
export async function dispatchCleanupInspections(
    ctx: CleanupQueryContext,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    budget: ExecutionBudget,
    plan: TriagePlan,
    coordinatorLedger: CleanupProvenanceLedger,
    segments: RunSegment[],
): Promise<InspectReport[]> {
    const candidateIds = new Set(batch.candidates.map((candidate) => candidate.id));
    const assignments = oneInspectPerTask(
        plan.inspect.filter((assignment) => candidateIds.has(assignment.taskId)),
    );
    const leases = budget.leaseMany(assignments.map((assignment) => inspectDepthShare(assignment.depth)), 1);
    const runs = await Promise.all(
        assignments.map((assignment, index) => runCleanupInspect(ctx, deps, batch, assignment, leases[index]!)),
    );

    const reports: InspectReport[] = [];
    runs.forEach((run, index) => {
        budget.settle(leases[index]!, { costUsd: run.accounting.costUsd, numTurns: run.accounting.numTurns });
        coordinatorLedger.mergeFrom(run.ledger);
        reports.push(run.report);
        segments.push({ accounting: run.accounting, steps: run.steps, nodeName: fanOutNode(AGENT_NODE.inspect, run.report.taskId) });
    });
    return reports;
}

/** 지금까지 모인 조사 보고로 결정 호출을 실행하고, 실제 지출을 정산해 궤적에 남긴다. */
export async function decideCleanup(
    ctx: CleanupQueryContext,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    budget: ExecutionBudget,
    floorLease: AgentBudgetLease,
    reports: readonly InspectReport[],
    coordinatorLedger: CleanupProvenanceLedger,
    input: GenerateCleanupSuggestionsInput,
    segments: RunSegment[],
): Promise<CleanupDecisionRun> {
    const lease = budget.combine([floorLease, budget.lease(1)]);
    const prompt = buildCleanupUserPrompt(ctx.prompt, input.maxSuggestions, input.scannedAt, input.language, reports);
    const run = await runCleanupDecision(ctx, deps, batch, coordinatorLedger, prompt, lease, AGENT_NODE.investigate);
    budget.settle(lease, { costUsd: run.costUsd, numTurns: run.numTurns });
    segments.push(toRunSegment(run, AGENT_NODE.investigate));
    return run;
}

export function toRunSegment(run: StructuredQueryResult<unknown>, nodeName: string): RunSegment {
    return {
        accounting: { durationMs: run.durationMs, costUsd: run.costUsd, numTurns: run.numTurns, usage: run.usage },
        steps: run.steps,
        nodeName,
        landed: run.landed,
    };
}
