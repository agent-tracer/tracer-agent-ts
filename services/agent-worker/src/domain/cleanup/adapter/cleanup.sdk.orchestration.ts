import type { JobStepPayload, StructuredQueryResult } from "@tracer-agent/llm";
import type { AgentBudgetLease, ExecutionBudget } from "~agent-worker/support/llm/agent.budget.js";
import type { AgentCallAccounting } from "~agent-worker/support/llm/agent.accounting.js";
import { buildCleanupUserPrompt } from "~agent-worker/domain/cleanup/model/cleanup.prompt.js";
import type { InspectReport, TriagePlan } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import { CleanupProvenanceLedger } from "~agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import type { GenerateCleanupSuggestionsInput } from "~agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import type { CleanupToolBatch, CleanupToolDeps } from "./cleanup.tools.js";
import type { CleanupQueryContext } from "./cleanup.sdk.query.js";
import { runCleanupTriage } from "./cleanup.sdk.triage.js";
import { agentFailureAccounting, runCleanupInspect } from "./cleanup.sdk.inspect.js";
import { runCleanupDecision, type CleanupDecisionRun } from "./cleanup.sdk.investigate.js";

const EMPTY_PLAN: TriagePlan = { inspect: [] };

export interface CleanupRunSegment {
    readonly accounting: AgentCallAccounting;
    readonly steps: readonly JobStepPayload[];
    readonly nodeName: string;
}

/** 선별이 후보 목록 도구만 쥐고 무엇을 열어볼지 정하며, 호출이 무너지면 아무도 열어보지 않는 빈 계획으로 대체한다. */
export async function runCleanupTriagePhase(
    ctx: CleanupQueryContext,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    budget: ExecutionBudget,
    lease: AgentBudgetLease,
    segments: CleanupRunSegment[],
): Promise<{ readonly plan: TriagePlan; readonly ledger: CleanupProvenanceLedger }> {
    if (lease.maxTurns <= 0) return { plan: EMPTY_PLAN, ledger: new CleanupProvenanceLedger() };
    try {
        const { result, ledger } = await runCleanupTriage(ctx, deps, batch, lease);
        budget.settle(lease, { costUsd: result.costUsd, numTurns: result.numTurns });
        segments.push(toCleanupRunSegment(result, "triage"));
        return { plan: result.data, ledger };
    } catch (error) {
        const accounting = agentFailureAccounting(error);
        budget.settle(lease, { costUsd: accounting.costUsd, numTurns: accounting.numTurns });
        segments.push({ accounting, steps: [], nodeName: "triage" });
        return { plan: EMPTY_PLAN, ledger: new CleanupProvenanceLedger() };
    }
}

/** 계획대로 후보를 병렬로 열어보고, 보고가 모이면 장부를 조율자 장부로 합친다. */
export async function dispatchCleanupInspections(
    ctx: CleanupQueryContext,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    budget: ExecutionBudget,
    plan: TriagePlan,
    coordinatorLedger: CleanupProvenanceLedger,
    segments: CleanupRunSegment[],
): Promise<InspectReport[]> {
    const candidateIds = new Set(batch.candidates.map((candidate) => candidate.id));
    const assignments = plan.inspect.filter((assignment) => candidateIds.has(assignment.taskId));
    const leases = budget.leaseMany(assignments.map((assignment) => assignment.weight), 1);
    const runs = await Promise.all(
        assignments.map((assignment, index) => runCleanupInspect(ctx, deps, batch, assignment, leases[index]!)),
    );

    const reports: InspectReport[] = [];
    runs.forEach((run, index) => {
        budget.settle(leases[index]!, { costUsd: run.accounting.costUsd, numTurns: run.accounting.numTurns });
        coordinatorLedger.mergeFrom(run.ledger);
        reports.push(run.report);
        segments.push({ accounting: run.accounting, steps: run.steps, nodeName: `inspect:${run.report.taskId}` });
    });
    return reports;
}

/** 지금까지 모인 조사 보고로 결정 호출을 돌리고, 실제 지출을 정산해 궤적에 남긴다. */
export async function decideCleanup(
    ctx: CleanupQueryContext,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    budget: ExecutionBudget,
    floorLease: AgentBudgetLease,
    reports: readonly InspectReport[],
    coordinatorLedger: CleanupProvenanceLedger,
    input: GenerateCleanupSuggestionsInput,
    segments: CleanupRunSegment[],
): Promise<CleanupDecisionRun> {
    const lease = budget.combine([floorLease, budget.lease(1)]);
    const prompt = buildCleanupUserPrompt(input.maxSuggestions, input.scannedAt, reports);
    const run = await runCleanupDecision(ctx, deps, batch, coordinatorLedger, prompt, lease, "investigate");
    budget.settle(lease, { costUsd: run.costUsd, numTurns: run.numTurns });
    segments.push(toCleanupRunSegment(run, "investigate"));
    return run;
}

export function toCleanupRunSegment(run: StructuredQueryResult<unknown>, nodeName: string): CleanupRunSegment {
    return {
        accounting: { durationMs: run.durationMs, costUsd: run.costUsd, numTurns: run.numTurns, usage: run.usage },
        steps: run.steps,
        nodeName,
    };
}
