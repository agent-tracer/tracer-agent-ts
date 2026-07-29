import { z } from "zod";

/** 제목 후보 하나이며 모양은 계약의 title-suggestion 출력이 소유한다. */
export const titleSuggestionSchema = z.object({
    title: z.string().trim().min(1).max(80),
    rationale: z.string().trim().min(1).max(200),
});

export type TitleSuggestionPayload = z.infer<typeof titleSuggestionSchema>;

/** 지금의 제목이 적절하면 빈 배열이고 아니면 2~3개이며 여기에는 폭주를 끊는 상한만 둔다. */
export const titleSuggestionsListSchema = z.object({
    suggestions: z.array(titleSuggestionSchema).max(3),
});

export type TitleSuggestionsList = z.infer<typeof titleSuggestionsListSchema>;
