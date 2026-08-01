import { Client, RunTree } from "langsmith";
import type { KVMap } from "langsmith/schemas";
import { v5 as uuidv5 } from "uuid";
import { AGENT_BACKEND } from "~llm/model/agent.axis.js";
import type { AgentQueryRequest } from "~llm/runner/llm.runner.js";
import type { ClaudeQueryOptions } from "./claude.query.options.js";

const TRACE_RUN_NAMESPACE = "90dd2ae3-e1b4-43bc-9538-f70898c147bd";

const SECRET_VALUE = /(?:sk-ant-|lsv2_|bearer\s+|oauth|api[_-]?key)/iu;
const SECRET_KEY = /(?:api.?key|authorization|callback.?token|oauth|password|scope.?token|secret|token|user.?id)/iu;

/** 자격 증명처럼 보이는 문자열을 관측 밖으로 내보내지 않는다. */
export function redactSecretText(value: string): string {
    return SECRET_VALUE.test(value) ? "[REDACTED]" : value;
}

export function redactTracePayload(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return redactSecretText(value);
    if (typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(redactTracePayload);
    return redactTraceRecord(value);
}

function redactTraceRecord(obj: object): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        redacted[key] = SECRET_KEY.test(key) ? "[REDACTED]" : redactTracePayload(value);
    }
    return redacted;
}

/** 추적 콜백이 넘기는 가변 값을 unknown 기반 재귀 검사로 좁힌다. */
function redactKVMap(value: KVMap): KVMap {
    return redactTraceRecord(value);
}

export async function createClaudeRunTree(
    request: AgentQueryRequest<ClaudeQueryOptions>,
    discloseTracePayloads: boolean,
): Promise<RunTree | null> {
    if (process.env.LANGSMITH_TRACING !== "true") return null;
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
            hideInputs: discloseTracePayloads ? redactKVMap : true,
            hideOutputs: discloseTracePayloads ? redactKVMap : true,
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
    } catch {
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
    } catch {
        return;
    }
}
