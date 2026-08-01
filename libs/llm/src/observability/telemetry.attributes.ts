import { createHash } from "node:crypto";
import type { Attributes } from "@opentelemetry/api";
import type { AgentBackend } from "~llm/model/agent.backend.js";
import type { AgentQueryUsage } from "~llm/model/agent.usage.js";
import {
    AGENT_TRACER_ATTR,
    GEN_AI_OPERATION,
    GEN_AI_PROVIDER,
    GEN_AI_TOKEN_TYPE,
    GEN_AI_TOOL_TYPE,
    SEMCONV_ATTR,
    type GenAiOperation,
    type GenAiProvider,
} from "./semconv.const.js";

const DEFAULT_AGENT_NAME = "ai-job";

export interface InvokeAgentTelemetryInput {
    readonly jobId: string;
    readonly jobKind: string;
    readonly agentName: string;
    readonly model?: string;
    readonly backend: AgentBackend;
    readonly conversationId?: string | undefined;
    readonly observation?: AgentTelemetryIdentity;
}

export interface AgentTelemetryIdentity {
    readonly executionId?: string;
    readonly attemptId?: string;
    readonly promptVersion?: string;
    readonly toolContractVersion?: string;
    readonly modelCallId?: string;
}

export interface GenAiClientAttributeInput {
    readonly jobId?: string | undefined;
    readonly operationName: GenAiOperation;
    readonly provider: GenAiProvider;
    readonly model: string;
    readonly usage?: AgentQueryUsage | null;
    readonly errorSubtype?: string | null;
    readonly observation?: AgentTelemetryIdentity;
}

export interface ToolTelemetryInput {
    readonly toolName: string;
    readonly agentName?: string;
    readonly parameters?: unknown;
    readonly observation?: AgentTelemetryIdentity;
}

// 메트릭 라벨에 잡 단위 식별자를 실으면 잡 하나가 시계열 하나를 차지해 rate가 0이 된다.
export function buildInvokeAgentAttributes(input: InvokeAgentTelemetryInput): Attributes {
    return compactAttributes({
        [SEMCONV_ATTR.operationName]: GEN_AI_OPERATION.invokeAgent,
        [SEMCONV_ATTR.providerName]: GEN_AI_PROVIDER.anthropic,
        [SEMCONV_ATTR.agentName]: input.agentName,
        [SEMCONV_ATTR.requestModel]: input.model,
        [AGENT_TRACER_ATTR.jobKind]: input.jobKind,
        [AGENT_TRACER_ATTR.backend]: input.backend,
    });
}

export function buildInvokeAgentSpanAttributes(input: InvokeAgentTelemetryInput): Attributes {
    return compactAttributes({
        ...buildInvokeAgentAttributes(input),
        [AGENT_TRACER_ATTR.jobId]: input.jobId,
        ...buildObservationAttributes(input.observation),
        [SEMCONV_ATTR.conversationId]: input.conversationId,
    });
}

export function buildGenAiClientAttributes(input: GenAiClientAttributeInput): Attributes {
    return compactAttributes({
        [SEMCONV_ATTR.operationName]: input.operationName,
        [SEMCONV_ATTR.providerName]: input.provider,
        [SEMCONV_ATTR.requestModel]: input.model,
        [SEMCONV_ATTR.responseModel]: input.model,
        [SEMCONV_ATTR.errorType]: input.errorSubtype,
    });
}

export function buildGenAiClientSpanAttributes(input: GenAiClientAttributeInput): Attributes {
    return compactAttributes({
        ...buildGenAiClientAttributes(input),
        [AGENT_TRACER_ATTR.jobId]: input.jobId,
        ...buildObservationAttributes(input.observation),
        [SEMCONV_ATTR.inputTokens]: totalInputTokensOf(input.usage),
        [SEMCONV_ATTR.outputTokens]: input.usage?.outputTokens,
        [SEMCONV_ATTR.cacheReadInputTokens]: input.usage?.cacheReadTokens,
        [SEMCONV_ATTR.cacheCreationInputTokens]: input.usage?.cacheCreationTokens,
        [AGENT_TRACER_ATTR.billableBaseInputTokens]: input.usage?.inputTokens,
    });
}

// 표준은 캐시 토큰을 포함한 총 입력을 권고하고 과금 기준인 베이스 입력은 따로 낸다.
function totalInputTokensOf(usage: AgentQueryUsage | null | undefined): number | undefined {
    if (!usage) return undefined;
    return usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens;
}

export function buildToolAttributes(input: ToolTelemetryInput): Attributes {
    return compactAttributes({
        [SEMCONV_ATTR.operationName]: GEN_AI_OPERATION.executeTool,
        [SEMCONV_ATTR.toolName]: input.toolName,
        [SEMCONV_ATTR.toolType]: GEN_AI_TOOL_TYPE.datastore,
        [SEMCONV_ATTR.agentName]: input.agentName ?? DEFAULT_AGENT_NAME,
    });
}

export function buildToolSpanAttributes(input: ToolTelemetryInput): Attributes {
    return compactAttributes({
        ...buildToolAttributes(input),
        [AGENT_TRACER_ATTR.toolParametersFingerprint]: toolParameterFingerprint(input.parameters),
        ...buildObservationAttributes(input.observation),
    });
}

function buildObservationAttributes(input: AgentTelemetryIdentity | undefined): Attributes {
    if (!input) return {};
    return compactAttributes({
        [AGENT_TRACER_ATTR.executionId]: input.executionId,
        [AGENT_TRACER_ATTR.attemptId]: input.attemptId,
        [AGENT_TRACER_ATTR.promptVersion]: input.promptVersion,
        [AGENT_TRACER_ATTR.toolContractVersion]: input.toolContractVersion,
        [AGENT_TRACER_ATTR.modelCallId]: input.modelCallId,
    });
}

export function toolParameterFingerprint(parameters: unknown): string | undefined {
    if (parameters === undefined) return undefined;
    const payload = JSON.stringify(normalizeParameter(parameters));
    return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function buildTokenUsageMeasurements(
    usage: AgentQueryUsage | null | undefined,
): readonly { readonly value: number; readonly attributes: Attributes }[] {
    if (!usage) return [];
    return [
        { value: usage.inputTokens, attributes: { [SEMCONV_ATTR.tokenType]: GEN_AI_TOKEN_TYPE.input } },
        { value: usage.outputTokens, attributes: { [SEMCONV_ATTR.tokenType]: GEN_AI_TOKEN_TYPE.output } },
    ];
}

function compactAttributes(attrs: Record<string, Attributes[string] | undefined | null>): Attributes {
    return Object.fromEntries(
        Object.entries(attrs).filter(
            (entry): entry is [string, Attributes[string]] => entry[1] !== undefined && entry[1] !== null,
        ),
    );
}

function normalizeParameter(value: unknown): unknown {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.map((item) => normalizeParameter(item));
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, normalizeParameter(item)]),
        );
    }
    return null;
}
