import { trace } from "@opentelemetry/api";

// Alloy가 trace_id·span_id를 이 이름 그대로 읽어 구조화 메타데이터로 올리고 Grafana가 Tempo로 잇는다.
function traceFields(): Record<string, string> {
    const span = trace.getActiveSpan();
    if (span === undefined) return {};
    const { traceId, spanId } = span.spanContext();
    return { trace_id: traceId, span_id: spanId };
}

function write(stream: NodeJS.WriteStream, level: string, fields: Record<string, unknown>): void {
    stream.write(`${JSON.stringify({ level, ts: new Date().toISOString(), ...traceFields(), ...fields })}\n`);
}

export function logInfo(fields: Record<string, unknown>): void {
    write(process.stdout, "info", fields);
}

export function logWarn(fields: Record<string, unknown>): void {
    write(process.stdout, "warn", fields);
}

export function logError(fields: Record<string, unknown>): void {
    write(process.stderr, "error", fields);
}

export function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "unknown error";
}
