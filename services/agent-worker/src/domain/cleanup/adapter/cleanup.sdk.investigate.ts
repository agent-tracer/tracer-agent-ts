import { zodToClaudeOutputSchema, type StructuredQueryResult } from "@tracer-agent/llm";
import { type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
import {
    buildCleanupSystemPrompt,
    CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
} from "~agent-worker/domain/cleanup/model/cleanup.prompt.js";
import { CLEANUP_COORDINATOR_TOOLS } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";
import { cleanupDecisionSchema, type CleanupDecision } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import { TASK_CLEANUP_TOOLS } from "~agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import type { CleanupProvenanceLedger } from "~agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import { buildCleanupToolHandlers, type CleanupToolBatch, type CleanupToolDeps } from "./cleanup.tools.js";
import { runCleanupQuery, TASK_CLEANUP_SPEC, type CleanupQueryContext } from "./cleanup.sdk.query.js";

const COORDINATOR_TOOL_SPECS = TASK_CLEANUP_TOOLS.filter((spec) => CLEANUP_COORDINATOR_TOOLS.includes(spec.name));

export type CleanupDecisionRun = StructuredQueryResult<CleanupDecision>;

/** 결정과 수리가 공유하는, 검토 전문가가 합친 장부만 쥐고 도구 없이 도는 호출이다. */
export function runCleanupDecision(
    ctx: CleanupQueryContext,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    ledger: CleanupProvenanceLedger,
    prompt: string,
    lease: AgentBudgetLease,
    label: string,
): Promise<CleanupDecisionRun> {
    const systemPrompt = buildCleanupSystemPrompt(ctx.prompt, ctx.input.language);
    ctx.resolvedTemplates.set(CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY, systemPrompt);
    return runCleanupQuery(ctx, {
        label: `${TASK_CLEANUP_SPEC.name}:${label}`,
        prompt,
        systemPrompt,
        toolNames: CLEANUP_COORDINATOR_TOOLS,
        toolSpecs: COORDINATOR_TOOL_SPECS,
        handlers: buildCleanupToolHandlers(ctx.input.userId, deps, batch, ledger),
        outputSchema: cleanupDecisionSchema,
        claudeOutputSchema: zodToClaudeOutputSchema(cleanupDecisionSchema),
        lease,
    });
}
