import type { TitleSuggestionPayload } from "./title.suggestion.schema.js";

const PLACEHOLDER_TITLES: ReadonlySet<string> = new Set(["untitled", "test"]);
const PLACEHOLDER_PATTERN = /^task(?:[\s\-_:#])*\d+$/;
const MIN_SUGGESTIONS = 2;
// 상한은 출력 스키마가 이미 끊으므로 여기서는 모자란 개수만 모델에게 돌려준다.
const MAX_SUGGESTIONS = 3;

/** 모델이 낸 제목 후보가 받아들일 수 있는 제목인지 검사하며 오류는 모델에게 돌려줄 문장이다. */
export function validateTitleSuggestions(
    suggestions: readonly TitleSuggestionPayload[],
    currentTitle: string,
): readonly string[] {
    // 제목이 이미 적절하면 제안하지 않는 것이 옳은 답이므로 빈 출력은 오류가 아니다.
    if (suggestions.length === 0) return [];

    const errors: string[] = [];
    if (suggestions.length < MIN_SUGGESTIONS) {
        errors.push(`suggestions must be empty or contain ${MIN_SUGGESTIONS}-${MAX_SUGGESTIONS} items`);
    }

    const current = normalizeTitle(currentTitle);
    const seen = new Set<string>();
    suggestions.forEach((suggestion, index) => {
        const normalized = normalizeTitle(suggestion.title);
        const position = index + 1;
        if (normalized === current) errors.push(`suggestion ${position} repeats the current title`);
        if (seen.has(normalized)) errors.push(`suggestion ${position} duplicates another suggestion`);
        seen.add(normalized);
        if (isPlaceholder(normalized)) errors.push(`suggestion ${position} is a placeholder title`);
    });
    return errors;
}

function normalizeTitle(value: string): string {
    return value
        .normalize("NFKC")
        .split(/\s+/u)
        .filter((part) => part.length > 0)
        .join(" ")
        .toLowerCase();
}

function isPlaceholder(normalized: string): boolean {
    return PLACEHOLDER_TITLES.has(normalized) || PLACEHOLDER_PATTERN.test(normalized);
}
