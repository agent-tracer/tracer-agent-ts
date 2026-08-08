import { boundedText } from "@tracer-agent/llm";
import { readAgentOutput } from "~agent-worker/support/contract.js";
import { z } from "zod";

interface DeclaredList {
    readonly properties: { readonly suggestions: { readonly maxItems: number } };
}

/** 후보 개수의 상한은 계약의 출력 스키마가 갖고 이 축은 그 값을 읽어 쓴다. */
export const TITLE_MAX_SUGGESTIONS =
    (readAgentOutput("title-suggestion").schema as unknown as DeclaredList).properties.suggestions.maxItems;

/** 빈 답이 아닌 이상 이만큼은 내야 하며 모자란 개수는 이 축의 검증기가 잡는다. */
export const TITLE_MIN_SUGGESTIONS = 2;

/** 제목 후보 하나이며 모양은 계약의 title-suggestion 출력이 소유한다. */
export const titleSuggestionSchema = z.object({
    title: boundedText(80),
    rationale: boundedText(200),
});

export type TitleSuggestionPayload = z.infer<typeof titleSuggestionSchema>;

/** 지금의 제목이 적절하면 빈 배열이고 아니면 2~3개이며 여기에는 폭주를 끊는 상한만 둔다. */
export const titleSuggestionsListSchema = z.object({
    suggestions: z.array(titleSuggestionSchema).max(TITLE_MAX_SUGGESTIONS),
});

export type TitleSuggestionsList = z.infer<typeof titleSuggestionsListSchema>;
