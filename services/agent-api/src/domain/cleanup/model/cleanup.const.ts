export const CLEANUP_SUGGESTION_KIND = {
    archive: "archive",
} as const;

export const CLEANUP_SUGGESTION_KINDS = [CLEANUP_SUGGESTION_KIND.archive] as const;

export type CleanupSuggestionKind = (typeof CLEANUP_SUGGESTION_KINDS)[number];

export const CLEANUP_SUGGESTION_STATUS = {
    pending: "pending",
    accepted: "accepted",
    dismissed: "dismissed",
} as const;

/** 목록 창구가 상태를 싣지 않았을 때 결과를 이어 붙이는 순서다. */
export const CLEANUP_SUGGESTION_STATUSES = [
    CLEANUP_SUGGESTION_STATUS.pending,
    CLEANUP_SUGGESTION_STATUS.accepted,
    CLEANUP_SUGGESTION_STATUS.dismissed,
] as const;

export type CleanupSuggestionStatus = (typeof CLEANUP_SUGGESTION_STATUSES)[number];
