/** 완료 알림에 실을 요약 문장이다. */
export function titleSuggestionSummary(suggestionCount: number): string {
    if (suggestionCount === 0) return "No title alternatives produced";
    return `${suggestionCount} title ${suggestionCount === 1 ? "suggestion" : "suggestions"}`;
}
