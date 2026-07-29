import type { ModelUsage, SDKResultError } from "@anthropic-ai/claude-agent-sdk";
import { AGENT_ERROR_SUBTYPE } from "~llm/model/agent.error.js";
import type { AgentQueryUsage } from "~llm/model/agent.usage.js";

/** SDK가 보고한 토큰 사용량의 와이어 모양이다. */
export interface SdkUsage {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cache_read_input_tokens: number;
    readonly cache_creation_input_tokens: number;
}

export function toToolArgs(input: unknown): Record<string, unknown> {
    return typeof input === "object" && input !== null && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
}

export function toolResultText(content: unknown): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    let text = "";
    for (const block of content) {
        if (typeof block === "object" && block !== null && (block as { type?: string }).type === "text") {
            text += (block as { text?: string }).text ?? "";
        }
    }
    return text;
}

export function dominantModel(modelUsage: Record<string, ModelUsage> | undefined): string | null {
    let best: string | null = null;
    let bestTokens = -1;
    for (const [model, usage] of Object.entries(modelUsage ?? {})) {
        const tokens = usage.inputTokens + usage.outputTokens;
        if (tokens > bestTokens) {
            best = model;
            bestTokens = tokens;
        }
    }
    return best;
}

export function normalizeClaudeResultSubtype(subtype: SDKResultError["subtype"]): string {
    switch (subtype) {
        case "error_max_turns":
            return AGENT_ERROR_SUBTYPE.maxTurnsExceeded;
        case "error_max_budget_usd":
            return AGENT_ERROR_SUBTYPE.budgetExceeded;
        case "error_max_structured_output_retries":
            return AGENT_ERROR_SUBTYPE.outputSchemaInvalid;
        case "error_during_execution":
            return AGENT_ERROR_SUBTYPE.executionError;
        default:
            return AGENT_ERROR_SUBTYPE.executionError;
    }
}

export function toUsage(usage: SdkUsage): AgentQueryUsage {
    return {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens,
        cacheCreationTokens: usage.cache_creation_input_tokens,
    };
}
