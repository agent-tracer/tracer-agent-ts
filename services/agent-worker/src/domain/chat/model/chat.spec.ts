import { featureLimits, featureModels } from "@tracer-agent/llm";
import { AGENT } from "~agent-worker/support/agent.const.js";
import type { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { CHAT_FEATURE } from "./chat.const.js";
import { buildChatSystemPrompt } from "./chat.prompt.js";
import { chatTurnResultSchema } from "./chat.result.schema.js";
import { CHAT_TOOL_DEFINITIONS, CHAT_TOOL_FAILURES, CHAT_TOOL_NAMES } from "./chat.tool.schema.js";

const LIMITS = featureLimits(CHAT_FEATURE);

/** 두 구현체가 같은 명세를 읽고 서로 다른 방언으로 렌더링하는 대화 에이전트 정의다. */
export const CHAT_SPEC = {
    name: AGENT.chat.id,
    systemPrompt: (prompt: AgentPrompt, language: string): string =>
        buildChatSystemPrompt(prompt, language),
    tools: CHAT_TOOL_DEFINITIONS,
    toolNames: CHAT_TOOL_NAMES,
    failures: CHAT_TOOL_FAILURES,
    outputSchema: chatTurnResultSchema,
    limits: {
        defaultModel: featureModels(CHAT_FEATURE)!.default,
        maxTurns: LIMITS.maxTurns,
        maxOutputTokens: LIMITS.maxOutputTokens,
        maxBudgetUsd: LIMITS.budgetUsd,
        deadlineMs: LIMITS.deadlineMs,
        stallMs: LIMITS.stallMs ?? LIMITS.deadlineMs,
    },
} as const;
