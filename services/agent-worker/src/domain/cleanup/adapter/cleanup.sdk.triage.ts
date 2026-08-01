import { zodToClaudeOutputSchema, type StructuredQueryResult } from "@tracer-agent/llm";
import { type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
import {
    buildCleanupTriagePrompt,
    buildCleanupTriageSystemPrompt,
} from "~agent-worker/domain/cleanup/model/cleanup.prompt.js";
import { triagePlanSchema, type TriagePlan } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import { CLEANUP_TRIAGE_TOOLS } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";
import { TASK_CLEANUP_TOOLS } from "~agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import { CleanupProvenanceLedger } from "~agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import { buildCleanupToolHandlers, type CleanupToolBatch, type CleanupToolDeps } from "./cleanup.tools.js";
import { runCleanupQuery, TASK_CLEANUP_SPEC, type CleanupQueryContext } from "./cleanup.sdk.query.js";

const TRIAGE_TOOL_NAMES = CLEANUP_TRIAGE_TOOLS;
const TRIAGE_TOOL_SPECS = TASK_CLEANUP_TOOLS.filter((spec) =>
    (CLEANUP_TRIAGE_TOOLS as readonly string[]).includes(spec.name));

export interface CleanupTriageRun {
    readonly result: StructuredQueryResult<TriagePlan>;
    readonly ledger: CleanupProvenanceLedger;
}

/** 선별이 후보 목록 도구만 쥐고 무엇을 열어볼지 정하게 하며, 노출한 후보를 자기 장부에 남긴다. */
export async function runCleanupTriage(
    ctx: CleanupQueryContext,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    lease: AgentBudgetLease,
): Promise<CleanupTriageRun> {
    const ledger = new CleanupProvenanceLedger();
    const systemPrompt = buildCleanupTriageSystemPrompt(ctx.prompt);
    const result = await runCleanupQuery(ctx, {
        label: `${TASK_CLEANUP_SPEC.name}:triage`,
        prompt: buildCleanupTriagePrompt(batch.candidates.length),
        systemPrompt,
        toolNames: TRIAGE_TOOL_NAMES,
        toolSpecs: TRIAGE_TOOL_SPECS,
        handlers: buildCleanupToolHandlers(ctx.input.userId, deps, batch, ledger),
        outputSchema: triagePlanSchema,
        claudeOutputSchema: zodToClaudeOutputSchema(triagePlanSchema),
        lease,
    });
    return { result, ledger };
}
