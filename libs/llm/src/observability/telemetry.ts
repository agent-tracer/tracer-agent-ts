import { metrics, SpanKind, SpanStatusCode, trace, type Attributes, type Span } from "@opentelemetry/api";
import { AgentExecutionFailure } from "~llm/model/agent.error.js";
import type { AgentQueryUsage } from "~llm/model/agent.usage.js";
import type { AgentQueryResult } from "~llm/runner/llm.runner.js";
import {
    GEN_AI_OBSERVABILITY_METRIC,
    GEN_AI_OPERATION,
    SEMCONV_ATTR,
    type GenAiOperation,
    type GenAiProvider,
} from "./semconv.const.js";
import {
    buildGenAiClientAttributes,
    buildGenAiClientSpanAttributes,
    buildInvokeAgentAttributes,
    buildInvokeAgentSpanAttributes,
    buildTokenUsageMeasurements,
    buildToolAttributes,
    buildToolSpanAttributes,
    type InvokeAgentTelemetryInput,
    type ToolTelemetryInput,
} from "./telemetry.attributes.js";

const INSTRUMENTATION_SCOPE = "agent-worker.ai-jobs";

const tracer = trace.getTracer(INSTRUMENTATION_SCOPE);
const meter = metrics.getMeter(INSTRUMENTATION_SCOPE);

const tokenUsage = meter.createHistogram(GEN_AI_OBSERVABILITY_METRIC.clientTokenUsage, {
    description: "Number of input and output tokens used by GenAI client operations.",
    unit: "{token}",
    advice: { explicitBucketBoundaries: [1, 4, 16, 64, 256, 1024, 4096, 16384, 65536] },
});

const clientDuration = meter.createHistogram(GEN_AI_OBSERVABILITY_METRIC.clientOperationDuration, {
    description: "GenAI client operation duration.",
    unit: "s",
    advice: { explicitBucketBoundaries: [0.01, 0.04, 0.16, 0.64, 2.56, 10.24, 40.96, 81.92] },
});

const invokeAgentDuration = meter.createHistogram(GEN_AI_OBSERVABILITY_METRIC.invokeAgentDuration, {
    description: "End-to-end duration of a single AI job agent invocation.",
    unit: "s",
    advice: { explicitBucketBoundaries: [0.1, 0.4, 1.6, 6.4, 25.6, 102.4, 409.6] },
});

const toolDuration = meter.createHistogram(GEN_AI_OBSERVABILITY_METRIC.executeToolDuration, {
    description: "Duration of an agent tool execution.",
    unit: "s",
    advice: { explicitBucketBoundaries: [0.01, 0.04, 0.16, 0.64, 2.56, 10.24, 40.96, 81.92] },
});

export async function withInvokeAgentTelemetry<T>(
    input: InvokeAgentTelemetryInput,
    run: () => Promise<T>,
): Promise<T> {
    const startedAt = Date.now();
    const metricAttributes = buildInvokeAgentAttributes(input);
    return tracer.startActiveSpan(
        `${GEN_AI_OPERATION.invokeAgent} ${input.agentName}`,
        { kind: SpanKind.INTERNAL, attributes: buildInvokeAgentSpanAttributes(input) },
        async (span) => {
            let errorType: string | null = null;
            try {
                return await run();
            } catch (err) {
                errorType = errorTypeOf(err);
                recordSpanError(span, err);
                throw err;
            } finally {
                invokeAgentDuration.record(
                    elapsedSeconds(startedAt),
                    errorType !== null
                        ? { ...metricAttributes, [SEMCONV_ATTR.errorType]: errorType }
                        : metricAttributes,
                );
                span.end();
            }
        },
    );
}

export async function withGenAiClientTelemetry<T extends AgentQueryResult>(
    input: {
        readonly model: string;
        readonly provider: GenAiProvider;
        readonly operationName?: GenAiOperation;
        readonly jobId?: string | undefined;
        readonly observation?: InvokeAgentTelemetryInput["observation"];
    },
    run: () => Promise<T>,
): Promise<T> {
    const startedAt = Date.now();
    const operationName = input.operationName ?? GEN_AI_OPERATION.chat;
    const base = {
        operationName,
        provider: input.provider,
        model: input.model,
        ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
        ...(input.observation !== undefined ? { observation: input.observation } : {}),
    };
    return tracer.startActiveSpan(
        `${operationName} ${input.model}`,
        { kind: SpanKind.CLIENT, attributes: buildGenAiClientSpanAttributes(base) },
        async (span) => {
            try {
                const result = await run();
                const enriched = { ...base, usage: result.usage, errorSubtype: result.errorSubtype };
                span.setAttributes(buildGenAiClientSpanAttributes(enriched));
                if (result.errorSubtype !== null) {
                    span.setStatus({ code: SpanStatusCode.ERROR, message: result.errorSubtype });
                }
                recordClientMetrics(elapsedSeconds(startedAt), buildGenAiClientAttributes(enriched), result.usage);
                return result;
            } catch (err) {
                recordSpanError(span, err);
                recordClientMetrics(
                    elapsedSeconds(startedAt),
                    { ...buildGenAiClientAttributes(base), [SEMCONV_ATTR.errorType]: errorTypeOf(err) },
                    null,
                );
                throw err;
            } finally {
                span.end();
            }
        },
    );
}

export async function withToolTelemetry<T>(input: ToolTelemetryInput, run: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    const metricAttributes = buildToolAttributes(input);
    return tracer.startActiveSpan(
        `${GEN_AI_OPERATION.executeTool} ${input.toolName}`,
        { kind: SpanKind.INTERNAL, attributes: buildToolSpanAttributes(input) },
        async (span) => {
            let errorType: string | null = null;
            try {
                return await run();
            } catch (err) {
                errorType = errorTypeOf(err);
                recordSpanError(span, err);
                throw err;
            } finally {
                toolDuration.record(
                    elapsedSeconds(startedAt),
                    errorType !== null
                        ? { ...metricAttributes, [SEMCONV_ATTR.errorType]: errorType }
                        : metricAttributes,
                );
                span.end();
            }
        },
    );
}

function recordClientMetrics(
    durationSeconds: number,
    attributes: Attributes,
    usage: AgentQueryUsage | null | undefined,
): void {
    clientDuration.record(durationSeconds, attributes);
    for (const measurement of buildTokenUsageMeasurements(usage)) {
        tokenUsage.record(measurement.value, { ...attributes, ...measurement.attributes });
    }
}

function recordSpanError(span: Span, err: unknown): void {
    span.recordException(err instanceof Error ? err : new Error(String(err)));
    span.setAttributes({ [SEMCONV_ATTR.errorType]: errorTypeOf(err) });
    span.setStatus({ code: SpanStatusCode.ERROR, message: messageOf(err) });
}

// 실행 실패의 이름은 전부 같으므로 라벨은 서브타입으로 구분한다.
function errorTypeOf(err: unknown): string {
    if (err instanceof AgentExecutionFailure) return err.errorSubtype ?? err.code;
    return err instanceof Error ? err.name : "_OTHER";
}

function messageOf(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function elapsedSeconds(startedAt: number): number {
    return (Date.now() - startedAt) / 1000;
}
