import { AGENT_NODE, type RunSegment } from "~agent-worker/support/llm/run.segment.js";
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
import {
    buildCleanupRepairPrompt,
    buildCleanupUserPrompt,
} from "~agent-worker/domain/cleanup/model/cleanup.prompt.js";
import { MAX_REDISPATCH_ROUNDS, type CleanupDecision, type TriagePlan } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import {
    MIN_DECISION_TURNS,
    REPAIR_RESERVED_BUDGET_SHARE,
    REPAIR_RESERVED_TURNS,
    TRIAGE_BUDGET_SHARE,
    TRIAGE_TURNS,
} from "~agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";
import { CleanupProvenanceLedger } from "~agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import { filterValidCleanupSuggestions } from "~agent-worker/domain/cleanup/model/cleanup.validation.model.js";
import type {
    CleanupAgentPort,
    GenerateCleanupSuggestionsInput,
    GenerateCleanupSuggestionsOutput,
} from "~agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import type { PromptSourcePort } from "~agent-worker/support/prompt.source.port.js";
import { type CleanupToolBatch, type CleanupToolDeps } from "./cleanup.tools.js";
import { TASK_CLEANUP_SPEC, type CleanupQueryContext } from "./cleanup.sdk.query.js";
import { runCleanupDecision, type CleanupDecisionRun } from "./cleanup.sdk.investigate.js";
import {
    decideCleanup,
    dispatchCleanupInspections,
    runCleanupTriagePhase,
    toRunSegment,} from "./cleanup.sdk.orchestration.js";
import {
    buildCleanupOutput,
    buildEmptyCleanupOutput,
    type CleanupValidationOutcome,
} from "./cleanup.sdk.output.js";
import { EMPTY_RESULT_REASON } from "~agent-worker/support/llm/empty.result.js";
import { recordModelLanded, recordValidationFailure } from "~agent-worker/support/llm/execution.metrics.js";
import type { CleanupSuggestionPayload } from "~agent-worker/domain/cleanup/model/cleanup.suggestion.schema.js";

const PASSED: CleanupValidationOutcome = { passed: true };
const FAILED: CleanupValidationOutcome = { passed: false };

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
        private readonly prompts: PromptSourcePort,
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
                backend: AGENT_BACKEND,
                ...(input.model !== undefined ? { model: input.model } : {}),
            },
            () => this.runAgent(input),
        );
    }

    private async runAgent(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput> {
        const ctx: CleanupQueryContext = {
            runner: this.runner,
            input,
            prompt: await this.prompts.resolve(AGENT.taskCleanup.id),
        };
        const batch: CleanupToolBatch = { candidates: input.candidates, batchTruncated: input.truncated };
        const { limits } = TASK_CLEANUP_SPEC;
        const budget = new ExecutionBudget({ maxBudgetUsd: limits.maxBudgetUsd, maxTurns: limits.maxTurns });

        // 수리와 선별과 결정 바닥을 먼저 떼어 두어, 후보별 배분이 그 몫을 침범하지 못하게 한다.
        const repairLease = budget.reserve(REPAIR_RESERVED_TURNS, REPAIR_RESERVED_BUDGET_SHARE);
        const triageLease = budget.reserve(TRIAGE_TURNS, TRIAGE_BUDGET_SHARE);
        const decisionFloorLease = budget.reserve(MIN_DECISION_TURNS, 0);

        const segments: RunSegment[] = [];
        const { plan, ledger: triageLedger, demoted } = await runCleanupTriagePhase(
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

        // 조율자가 아직 판정 못 한 후보를 지목하면 남은 예산 안에서 후보를 한 번 더 조회하고 다시 결정한다.
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

        const checked = filterValidCleanupSuggestions(decision.data.suggestions, coordinatorLedger.snapshot(), input.maxSuggestions);
        if (checked.errors.length === 0) {
            return this.settleOutput(ctx, segments, checked.valid, decision.modelUsed, PASSED, demoted);
        }

        // 예약된 몫마저 소진돼 수리를 시도할 수 없으면 오류가 아닌 빈 결과로 종료한다.
        if (repairLease.maxTurns <= 0) {
            recordValidationFailure(AGENT.taskCleanup.id, false);
            return this.settleOutput(ctx, segments, [], decision.modelUsed, FAILED, demoted);
        }

        const decisionPrompt = buildCleanupUserPrompt(ctx.prompt, input.maxSuggestions, input.scannedAt, input.language, reports);
        const repairPrompt = buildCleanupRepairPrompt(ctx.prompt, decisionPrompt, decision.data, checked.errors);
        let repaired: CleanupDecisionRun;
        try {
            repaired = await runCleanupDecision(ctx, this.deps, batch, coordinatorLedger, repairPrompt, repairLease, AGENT_NODE.repair);
        } catch (error) {
            // 예약해 둔 몫으로도 모델이 예산을 다 써버렸으면 잡을 실패시키지 않고 빈 결과로 종료한다.
            if (isBudgetExhaustedFailure(error)) {
                recordValidationFailure(AGENT.taskCleanup.id, false);
                return this.settleOutput(ctx, segments, [], decision.modelUsed, FAILED, demoted);
            }
            throw error;
        }
        budget.settle(repairLease, { costUsd: repaired.costUsd, numTurns: repaired.numTurns });
        segments.push(toRunSegment(repaired, AGENT_NODE.repair));

        const rechecked = filterValidCleanupSuggestions(repaired.data.suggestions, coordinatorLedger.snapshot(), input.maxSuggestions);
        const passed = rechecked.errors.length === 0;
        recordValidationFailure(AGENT.taskCleanup.id, passed);
        return this.settleOutput(
            ctx, segments, rechecked.valid, repaired.modelUsed, passed ? PASSED : FAILED, demoted,
        );
    }

    /** 옳은 빈 답과 검증 실패와 선별을 낮춘 실행이 원장에서 구분되도록 실제 검증 결과와 빈 결과의 사유를 함께 싣는다. */
    private settleOutput(
        ctx: CleanupQueryContext,
        segments: RunSegment[],
        suggestions: readonly CleanupSuggestionPayload[],
        modelUsed: string,
        validation: CleanupValidationOutcome,
        demoted: boolean,
    ): GenerateCleanupSuggestionsOutput {
        if (segments.some((segment) => segment.landed === true)) recordModelLanded(AGENT.taskCleanup.id);
        if (suggestions.length > 0) return buildCleanupOutput(ctx, segments, suggestions, modelUsed, validation);
        const reason = validation.passed && !demoted
            ? EMPTY_RESULT_REASON.noPattern
            : EMPTY_RESULT_REASON.generationDegraded;
        return buildEmptyCleanupOutput(ctx, segments, modelUsed, validation, reason);
    }
}

function wantsRedispatch(decision: CleanupDecision): boolean {
    return decision.suggestions.length === 0 && decision.redispatch.length > 0;
}
