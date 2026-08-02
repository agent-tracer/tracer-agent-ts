import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from "@anthropic-ai/claude-agent-sdk";
import type { AgentQueryRequest } from "~llm/runner/llm.runner.js";
import type { ClaudeQueryOptions } from "./claude.query.options.js";

/** Claude Agent SDK가 받는 시스템 지침의 세 모양이다. */
export type ClaudeSystemPrompt =
    | string
    | string[]
    | { type: "preset"; preset: "claude_code"; append: string; excludeDynamicSections?: boolean };

/** 지침을 정적 접두부와 턴별 맥락으로 나누어 앞쪽만 프롬프트 캐시에 남게 한다. */
export function buildSystemPrompt(
    request: AgentQueryRequest<ClaudeQueryOptions>,
    options: ClaudeQueryOptions | undefined,
): ClaudeSystemPrompt {
    const dynamic = request.dynamicSystemPrompt;
    if (options?.useClaudeCodePreset === true) {
        return {
            type: "preset" as const,
            preset: "claude_code" as const,
            append: dynamic === undefined ? request.systemPrompt : `${request.systemPrompt}\n\n${dynamic}`,
            ...(options.excludeDynamicSections === true ? { excludeDynamicSections: true } : {}),
        };
    }
    if (dynamic === undefined) return request.systemPrompt;
    return [request.systemPrompt, SYSTEM_PROMPT_DYNAMIC_BOUNDARY, dynamic];
}
