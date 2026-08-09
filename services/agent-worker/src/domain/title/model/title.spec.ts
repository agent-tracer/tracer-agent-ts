import { featureLimits, featureModels } from "@tracer-agent/llm";
import { AGENT } from "~agent-worker/support/agent.const.js";
import type { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import { TITLE_FEATURE } from "./title.const.js";
import type { TitleContext } from "./title.context.model.js";
import { buildTitleSystemPrompt, buildTitleUserPrompt } from "./title.prompt.js";
import { titleSuggestionsListSchema } from "./title.suggestion.schema.js";
import { TITLE_SUGGESTION_FAILURES, TITLE_SUGGESTION_TOOLS } from "./title.tool.schema.js";

const MODELS = featureModels(TITLE_FEATURE)!;
const LIMITS = featureLimits(TITLE_FEATURE);

/** 프롬프트를 조립하는 데 필요한 입력이다. */
export interface TitlePromptInput {
    readonly taskId: string;
    readonly language: OutputLanguage;
    readonly context: TitleContext;
}

/** 두 구현체가 같은 명세를 읽고 서로 다른 방언으로 렌더링하는 제목 제안 정의다. */
export const TITLE_SUGGESTION_SPEC = {
    name: AGENT.titleSuggestion.id,
    // 시스템 프롬프트가 호출마다 같아야 캐시가 걸리므로 언어 지시는 사용자 프롬프트가 싣는다.
    systemPrompt: (prompt: AgentPrompt): string => buildTitleSystemPrompt(prompt),
    userPrompt: (prompt: AgentPrompt, input: TitlePromptInput): string =>
        buildTitleUserPrompt(prompt, input.taskId, input.context, input.language),
    outputSchema: titleSuggestionsListSchema,
    tools: TITLE_SUGGESTION_TOOLS,
    failures: TITLE_SUGGESTION_FAILURES,
    limits: {
        defaultModel: MODELS.default,
        fallbackModel: MODELS.fallback ?? MODELS.default,
        maxTurns: LIMITS.maxTurns,
        deadlineMs: LIMITS.deadlineMs,
        maxOutputTokens: LIMITS.maxOutputTokens,
        maxBudgetUsd: LIMITS.budgetUsd,
    },
} as const;
