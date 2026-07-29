import {
    AGENT_BACKEND,
    isBudgetExhaustedFailure,
    withInvokeAgentTelemetry,
    type ClaudeQueryOptions,
    type IQueryRunner,
} from "@tracer-agent/llm";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { JOB_KIND } from "~agent-worker/support/job.const.js";
import { ExecutionBudget } from "~agent-worker/support/llm/agent.budget.js";
import type { PromptFragmentRunResolver } from "~agent-worker/support/resolved.prompt.fragments.js";
import { buildCleanupRepairPrompt, buildCleanupUserPrompt } from "~agent-worker/domain/cleanup/model/cleanup.prompt.js";
import { CLEANUP_INVESTIGATOR_REPAIR_TEMPLATE_KEY } from "~agent-worker/domain/cleanup/model/cleanup.prompt.fragments.js";
import { MAX_REDISPATCH_ROUNDS, type CleanupDecision, type TriagePlan } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import {
    MIN_DECISION_TURNS,
    REPAIR_RESERVED_BUDGET_SHARE,
    REPAIR_RESERVED_TURNS,
    TRIAGE_BUDGET_SHARE,
    TRIAGE_TURNS,
} from "~agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";
import { CleanupProvenanceLedger } from "~agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import { validateCleanupSuggestions } from "~agent-worker/domain/cleanup/model/cleanup.validation.model.js";
import type {
    CleanupAgentPort,
    GenerateCleanupSuggestionsInput,
    GenerateCleanupSuggestionsOutput,
} from "~agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import { type CleanupToolBatch, type CleanupToolDeps } from "./cleanup.tools.js";
import { TASK_CLEANUP_SPEC, type CleanupQueryContext } from "./cleanup.sdk.query.js";
import { runCleanupDecision, type CleanupDecisionRun } from "./cleanup.sdk.investigate.js";
import {
    decideCleanup,
    dispatchCleanupInspections,
    runCleanupTriagePhase,
    toCleanupRunSegment,
    type CleanupRunSegment,
} from "./cleanup.sdk.orchestration.js";
import { buildCleanupOutput } from "./cleanup.sdk.output.js";

export {
    CLEANUP_COORDINATOR_TOOLS,
    CLEANUP_REVIEWER_MAX_TURNS,
    CLEANUP_REVIEWER_ROLE,
    CLEANUP_REVIEWER_TOOLS,
    CLEANUP_TRIAGE_TOOLS,
} from "~agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";

/** Claude Agent SDK 방언으로 task-cleanup 명세를 렌더링해, 선별 → 후보별 조사 팬아웃 → 결정 → 검증 → 수리로 실행한다. */
export class CleanupSdkAgentAdapter implements CleanupAgentPort {
    constructor(
        private readonly runner: IQueryRunner<ClaudeQueryOptions>,
        private readonly deps: CleanupToolDeps,
        private readonly fragmentResolver?: () => PromptFragmentRunResolver,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.runner.requiresLocalApiKey();
    }

    async generate(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput> {
        return withInvokeAgentTelemetry(
            {
                jobId: input.jobId,
                jobKind: JOB_KIND.taskCleanup,
                agentName: AGENT.taskCleanup.id,
                backend: AGENT_BACKEND.claudeSdk,
                ...(input.model !== undefined ? { model: input.model } : {}),
            },
            () => this.runAgent(input),
        );
    }

    private async runAgent(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput> {
        const resolver = this.fragmentResolver?.();
        const ctx: CleanupQueryContext = {
            runner: this.runner,
            input,
            resolvedTemplates: new Map(),
            ...(resolver !== undefined ? { fragmentResolver: resolver } : {}),
        };
        const batch: CleanupToolBatch = { candidates: input.candidates, batchTruncated: input.truncated };
        const { limits } = TASK_CLEANUP_SPEC;
        const budget = new ExecutionBudget({ maxBudgetUsd: limits.maxBudgetUsd, maxTurns: limits.maxTurns });

        // 수리와 선별과 결정 바닥을 먼저 떼어 두어, 후보별 배분이 그 몫을 침범하지 못하게 한다.
        const repairLease = budget.reserve(REPAIR_RESERVED_TURNS, REPAIR_RESERVED_BUDGET_SHARE);
        const triageLease = budget.reserve(TRIAGE_TURNS, TRIAGE_BUDGET_SHARE);
        const decisionFloorLease = budget.reserve(MIN_DECISION_TURNS, 0);

        const segments: CleanupRunSegment[] = [];
        const { plan, ledger: triageLedger } = await runCleanupTriagePhase(
            ctx, this.deps, batch, budget, triageLease, segments,
        );

        const coordinatorLedger = new CleanupProvenanceLedger();
        coordinatorLedger.mergeFrom(triageLedger);
        const reports = plan.inspect.length === 0
            ? []
            : await dispatchCleanupInspections(ctx, this.deps, batch, budget, plan, coordinatorLedger, segments);

        let decision = await decideCleanup(
            ctx, this.deps, batch, budget, decisionFloorLease, reports, coordinatorLedger, input, segments,
        );

        // 조율자가 아직 판정 못 한 후보를 지목하면 남은 예산 안에서 후보를 한 번 더 열어보고 다시 결정한다.
        for (
            let round = 0;
            round < MAX_REDISPATCH_ROUNDS
            && wantsRedispatch(decision.data)
            && budget.hasRemainingCapacity(MIN_DECISION_TURNS + 1);
            round += 1
        ) {
            const candidateIds = new Set(batch.candidates.map((candidate) => candidate.id));
            const redispatch = decision.data.redispatch.filter((assignment) => candidateIds.has(assignment.taskId));
            if (redispatch.length === 0) break;
            const redispatchFloorLease = budget.reserve(MIN_DECISION_TURNS, 0);
            const redispatchPlan: TriagePlan = { inspect: redispatch };
            reports.push(
                ...(await dispatchCleanupInspections(
                    ctx, this.deps, batch, budget, redispatchPlan, coordinatorLedger, segments,
                )),
            );
            decision = await decideCleanup(
                ctx, this.deps, batch, budget, redispatchFloorLease, reports, coordinatorLedger, input, segments,
            );
        }

        const checked = validateCleanupSuggestions(decision.data.suggestions, coordinatorLedger.snapshot(), input.maxSuggestions);
        if (checked.errors.length === 0) return buildCleanupOutput(ctx, segments, checked.valid, decision.modelUsed);

        // 예약된 몫마저 바닥나 수리를 시도할 수 없으면 오류가 아닌 빈 결과로 착지한다.
        if (repairLease.maxTurns <= 0) return buildCleanupOutput(ctx, segments, [], decision.modelUsed);

        const decisionPrompt = buildCleanupUserPrompt(input.maxSuggestions, input.scannedAt, reports);
        const repairPrompt = buildCleanupRepairPrompt(decisionPrompt, decision.data, checked.errors, ctx.fragmentResolver);
        ctx.resolvedTemplates.set(CLEANUP_INVESTIGATOR_REPAIR_TEMPLATE_KEY, repairPrompt);
        let repaired: CleanupDecisionRun;
        try {
            repaired = await runCleanupDecision(ctx, this.deps, batch, coordinatorLedger, repairPrompt, repairLease, "repair");
        } catch (error) {
            // 예약해 둔 몫으로도 모델이 예산을 다 써버렸으면 잡을 실패시키지 않고 빈 결과로 착지한다.
            if (isBudgetExhaustedFailure(error)) return buildCleanupOutput(ctx, segments, [], decision.modelUsed);
            throw error;
        }
        budget.settle(repairLease, { costUsd: repaired.costUsd, numTurns: repaired.numTurns });
        segments.push(toCleanupRunSegment(repaired, "repair"));

        const rechecked = validateCleanupSuggestions(repaired.data.suggestions, coordinatorLedger.snapshot(), input.maxSuggestions);
        return buildCleanupOutput(ctx, segments, rechecked.valid, repaired.modelUsed);
    }
}

function wantsRedispatch(decision: CleanupDecision): boolean {
    return decision.suggestions.length === 0 && decision.redispatch.length > 0;
}
