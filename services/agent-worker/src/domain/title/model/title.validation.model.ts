import type { TitleSuggestionPayload } from "./title.suggestion.schema.js";

const PLACEHOLDER_TITLES: ReadonlySet<string> = new Set(["untitled", "test"]);
const PLACEHOLDER_PATTERN = /^task(?:[\s\-_:#])*\d+$/;
const MIN_SUGGESTIONS = 2;
// 상한은 출력 스키마가 이미 끊으므로 여기서는 모자란 개수만 모델에게 돌려준다.
const MAX_SUGGESTIONS = 3;

/** 쓸모없는 후보를 지운 결과와 모델이 고쳐야 하는 사유다. */
export interface NormalizedTitleSuggestions {
    readonly kept: readonly TitleSuggestionPayload[];
    readonly errors: readonly string[];
}

function shortfall(kept: number): string {
    return (
        `only ${kept} usable suggestion(s) remain after dropping unusable ones; ` +
        `return ${MIN_SUGGESTIONS}-${MAX_SUGGESTIONS} distinct titles that differ from the current one`
    );
}

/** 현재 제목을 되풀이하거나 서로 겹치거나 자리표시자인 후보를 지우고 모자란 수만 사유로 남긴다. */
export function normalizeTitleSuggestions(
    suggestions: readonly TitleSuggestionPayload[],
    currentTitle: string,
): NormalizedTitleSuggestions {
    // 제목이 이미 적절하면 제안하지 않는 것이 옳은 답이므로 빈 출력은 오류가 아니다.
    if (suggestions.length === 0) return { kept: [], errors: [] };

    const current = normalizeTitle(currentTitle);
    const seen = new Set<string>();
    const kept: TitleSuggestionPayload[] = [];
    for (const suggestion of suggestions) {
        const normalized = normalizeTitle(suggestion.title);
        if (normalized === current || seen.has(normalized) || isPlaceholder(normalized)) continue;
        seen.add(normalized);
        kept.push(suggestion);
    }
    if (kept.length < MIN_SUGGESTIONS) return { kept, errors: [shortfall(kept.length)] };
    return { kept, errors: [] };
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
