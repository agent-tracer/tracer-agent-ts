import { Client, RunTree } from "langsmith";
import type { KVMap } from "langsmith/schemas";
import { v5 as uuidv5 } from "uuid";
import { errorMessage, logWarn } from "@tracer-agent/platform";
import { AGENT_BACKEND } from "~llm/model/agent.axis.js";
import { isTracingEnabled } from "~llm/observability/trace.environment.js";
import type { AgentQueryRequest } from "~llm/runner/llm.runner.js";
import {
    hasSuspect,
    redactPayload,
    REDACTION_STAGE,
    stageDiscards,
} from "~llm/support/redaction.js";
import type { ClaudeQueryOptions } from "./claude.query.options.js";

const TRACE_RUN_NAMESPACE = "90dd2ae3-e1b4-43bc-9538-f70898c147bd";

/** 추적 콜백이 넘기는 가변 값을 계약이 trace 자리에 정한 처분으로 좁힌다. */
function hideTracePayload(value: KVMap): KVMap {
    if (stageDiscards(REDACTION_STAGE.trace)) return hasSuspect(value) ? {} : value;
    return redactPayload(value) as KVMap;
}

export async function createClaudeRunTree(
    request: AgentQueryRequest<ClaudeQueryOptions>,
    discloseTracePayloads: boolean,
): Promise<RunTree | null> {
    if (!isTracingEnabled()) return null;
    try {
        const logicalExecution = request.observation?.executionId || request.jobId;
        let runId: string | undefined = undefined;
        if (logicalExecution && request.observation?.attemptId) {
            runId = uuidv5(
                `${request.label}:${logicalExecution}:${request.observation.attemptId}`,
                TRACE_RUN_NAMESPACE,
            );
        }
        const client = new Client({
            hideInputs: discloseTracePayloads ? hideTracePayload : true,
            hideOutputs: discloseTracePayloads ? hideTracePayload : true,
        });
        const runTree = new RunTree({
            name: request.label,
            run_type: "llm",
            client,
            ...(runId ? { id: runId } : {}),
            inputs: { prompt: request.prompt },
            tags: [request.label, AGENT_BACKEND, request.observation?.promptVersion ?? "unknown"],
            extra: {
                metadata: {
                    "agent_tracer.agent.name": request.label,
                    "agent_tracer.backend": AGENT_BACKEND,
                    "agent_tracer.model.requested": request.model,
                    "agent_tracer.prompt.version": request.observation?.promptVersion,
                    "agent_tracer.tool.contract.version": request.observation?.toolContractVersion,
                    "agent_tracer.job.id": request.jobId,
                    "agent_tracer.execution.id": request.observation?.executionId,
                    "agent_tracer.attempt.id": request.observation?.attemptId,
                },
            },
        });
        await runTree.postRun();
        return runTree;
    } catch (error: unknown) {
        logWarn({ msg: "agent_trace.start.failed", label: request.label, error: errorMessage(error) });
        return null;
    }
}

export async function finishClaudeRunTree(
    runTree: RunTree,
    resultText: string,
    structuredOutput: unknown,
    errorSummary: string | null,
): Promise<void> {
    try {
        if (errorSummary) {
            await runTree.end({ error: errorSummary });
        } else {
            await runTree.end({ outputs: { result: resultText, structuredOutput } });
        }
        await runTree.patchRun();
    } catch (error: unknown) {
        logWarn({ msg: "agent_trace.finish.failed", label: runTree.name, error: errorMessage(error) });
    }
}
