import { type StructuredQueryResult } from "@tracer-agent/llm";
import { type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
import {
    buildCleanupSystemPrompt,
} from "~agent-worker/domain/cleanup/model/cleanup.prompt.js";
import { CLEANUP_COORDINATOR_TOOLS } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";
import { cleanupDecisionSchema, type CleanupDecision } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import type { CleanupProvenanceLedger } from "~agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import { buildCleanupToolHandlers, type CleanupToolBatch, type CleanupToolDeps } from "./cleanup.tools.js";
import { runCleanupQuery, TASK_CLEANUP_SPEC, type CleanupQueryContext } from "./cleanup.sdk.query.js";


export type CleanupDecisionRun = StructuredQueryResult<CleanupDecision>;

/** 결정과 수리가 공유하는, 검토 전문가가 합친 장부만 가지고 도구 없이 진행 중인 호출이다. */
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
    return runCleanupQuery(ctx, {
        label: `${TASK_CLEANUP_SPEC.name}:${label}`,
        prompt,
        systemPrompt,
        toolNames: CLEANUP_COORDINATOR_TOOLS,
        handlers: buildCleanupToolHandlers(ctx.input.userId, deps, batch, ledger),
        outputSchema: cleanupDecisionSchema,
        lease,
    });
}
